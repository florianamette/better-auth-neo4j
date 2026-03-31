import {
	createAdapterFactory,
	type AdapterFactoryOptions,
	type CleanedWhere,
	type CustomAdapter,
	type JoinConfig,
} from "better-auth/adapters";
import type {
	BetterAuthOptions,
} from "better-auth/types";
import type { DBFieldAttribute } from "better-auth/db";
import Cypher from "@neo4j/cypher-builder";
import type { ManagedTransaction, Session } from "neo4j-driver";
import { edgeTypeForChildLabel, escapeIdentifier } from "./label.js";
import {
	listCascadeChildTargets,
	mergeReferenceEdges,
	updateReferenceEdges,
} from "./relations.js";
import { asNeo4jParameterValue, nodeToPlain, propsForNeo4j } from "./neo4j-record.js";
import { buildWherePredicate } from "./where.js";
import type { Neo4jBetterAuthConfig } from "./types.js";

type BetterAuthFactory = ReturnType<typeof createAdapterFactory<BetterAuthOptions>>;
type TxAdapter = Awaited<ReturnType<BetterAuthFactory>>;
type QueryResult = Awaited<ReturnType<ManagedTransaction["run"]>>;
type RunCypherFn = (
	cypher: string,
	params?: Record<string, unknown>,
) => Promise<QueryResult>;

export function neo4jAdapter(
	input: Neo4jBetterAuthConfig,
): (options: BetterAuthOptions) => TxAdapter {
	if (!input.driver && !input.session) {
		throw new Error("neo4jAdapter: provide `driver` or `session`");
	}

	let lazyOptions: BetterAuthOptions | undefined;
	const database = input.database;
	const driver = input.driver;

	/** One session per operation when using a driver (avoids Neo4j "open transaction" errors under concurrency). */
	const withSession = async <T>(fn: (s: Session) => Promise<T>): Promise<T> => {
		if (input.session) return fn(input.session);
		const s = driver!.session({ database });
		try {
			return await fn(s);
		} finally {
			await s.close();
		}
	};

	const createInnerAdapter =
		(tx: ManagedTransaction | undefined) =>
		({
			schema,
			getModelName,
			getDefaultModelName,
			getFieldName,
		}: Parameters<AdapterFactoryOptions["adapter"]>[0]): CustomAdapter => {
			const withOperationError = <T>(op: string, promise: Promise<T>) =>
				promise.catch((cause: unknown) => {
					throw new Error(`neo4jAdapter: ${op} failed`, { cause });
				});

			const runWrite = async (
				cypher: string,
				params?: Record<string, unknown>,
			) => {
				try {
					if (tx) return tx.run(cypher, params);
					return withSession((s) =>
						s.executeWrite((t) => t.run(cypher, params)),
					);
				} catch {
					throw new Error("neo4jAdapter: write query failed");
				}
			};

			const runRead = async (
				cypher: string,
				params?: Record<string, unknown>,
			) => {
				try {
					if (tx) return tx.run(cypher, params);
					return withSession((s) =>
						s.executeRead((t) => t.run(cypher, params)),
					);
				} catch {
					throw new Error("neo4jAdapter: read query failed");
				}
			};

			const withWriteTransaction = async <T>(
				runFn: (run: RunCypherFn) => Promise<T>,
			): Promise<T> => {
				if (tx) {
					return runFn((cypher, params) => tx.run(cypher, params));
				}
				return withSession((s) =>
					s.executeWrite((t) =>
						runFn((cypher, params) => t.run(cypher, params)),
					),
				);
			};

			const lbl = (m: string) => escapeIdentifier(m);
			const allowedDbFieldsForModel = (model: string): Set<string> => {
				const defaultModel = getDefaultModelName(model);
				const table = schema[defaultModel];
				const out = new Set<string>();
				if (!table?.fields) return out;
				for (const field of Object.keys(table.fields)) {
					out.add(getFieldName({ model: defaultModel, field }));
				}
				return out;
			};

			const assertSortableField = (
				model: string,
				sortBy?: { field: string; direction: "asc" | "desc" },
			): void => {
				if (!sortBy) return;
				const fields = allowedDbFieldsForModel(model);
				if (!fields.has(sortBy.field)) {
					throw new Error(`neo4jAdapter: invalid sort field "${sortBy.field}"`);
				}
			};

			/**
			 * `select` uses schema field names; rows use DB keys (`fieldName` / getFieldName).
			 * Output keys must match what transformOutput reads (`field.fieldName || key`).
			 */
			function pickSelect(
				row: Record<string, unknown>,
				select: string[] | undefined,
				defaultModelKey: string,
			): Record<string, unknown> {
				if (!select?.length) return row;
				const out: Record<string, unknown> = {};
				for (const schemaField of select) {
					const db = getFieldName({
						model: defaultModelKey,
						field: schemaField,
					});
					out[db] = row[db];
				}
				return out;
			}

			function normalizeRow(
				defaultModelKey: string,
				row: Record<string, unknown>,
			): Record<string, unknown> {
				const table = schema[defaultModelKey];
				if (!table?.fields) return row;
				for (const [fieldKey, attr] of Object.entries(table.fields) as [
					string,
					DBFieldAttribute,
				][]) {
					if (attr.required) continue;
					if (attr.returned === false) continue;
					const dbName = getFieldName({
						model: defaultModelKey,
						field: fieldKey,
					});
					if (!(dbName in row)) {
						row[dbName] = null;
					}
				}
				return row;
			}

			function createNodeQuery(
				model: string,
				props: Record<string, unknown>,
			): { cypher: string; params: Record<string, unknown> } {
				const entries = Object.entries(props);
				const params: Record<string, unknown> = {};
				const sets: string[] = [];
				let i = 0;
				for (const [k, v] of entries) {
					if (v === null) continue;
					const pname = `cp${i++}`;
					params[pname] = asNeo4jParameterValue(v);
					sets.push(`n.${lbl(k)} = $${pname}`);
				}
				if (sets.length === 0) {
					return {
						cypher: `CREATE (n:${lbl(model)}) RETURN n`,
						params: {},
					};
				}
				return {
					cypher: `CREATE (n:${lbl(model)}) SET ${sets.join(", ")} RETURN n`,
					params,
				};
			}

			function matchPrefix(model: string, where: CleanedWhere[] | undefined): {
				cypher: string;
				params: Record<string, unknown>;
			} {
				const n = new Cypher.NamedNode("n");
				const pattern = new Cypher.Pattern(n, { labels: [model] });
				const { predicate, params: wp } = buildWherePredicate(
					n,
					where,
					allowedDbFieldsForModel(model),
				);
				const mq = predicate
					? new Cypher.Match(pattern).where(predicate)
					: new Cypher.Match(pattern);
				const built = mq.build();
				return { cypher: built.cypher, params: { ...built.params, ...wp } };
			}

			async function collectIds(
				run: RunCypherFn,
				model: string,
				where: CleanedWhere[] | undefined,
			): Promise<unknown[]> {
				const dk = getDefaultModelName(model);
				const idDb = getFieldName({ model: dk, field: "id" });
				const n = new Cypher.NamedNode("n");
				const pattern = new Cypher.Pattern(n, { labels: [model] });
				const { predicate, params: wp } = buildWherePredicate(
					n,
					where,
					allowedDbFieldsForModel(model),
				);
				const mq = (
					predicate
						? new Cypher.Match(pattern).where(predicate)
						: new Cypher.Match(pattern)
				).return([n.property(idDb), "id"]);
				const built = mq.build();
				const res = await run(built.cypher, {
					...built.params,
					...wp,
				});
				return res.records.map((r) => r.get("id"));
			}

			async function cascadeDeleteChildrenForUsers(
				run: RunCypherFn,
				userLabel: string,
				where: CleanedWhere[] | undefined,
			): Promise<void> {
				const ids = await collectIds(run, userLabel, where);
				if (ids.length === 0) return;
				const targets = listCascadeChildTargets(
					schema,
					"user",
					getDefaultModelName,
					getModelName,
					getFieldName,
				);
				for (const { childLabel, fkProp } of targets) {
					await run(
						`MATCH (n:${lbl(childLabel)}) WHERE n.${lbl(fkProp)} IN $ids DETACH DELETE n`,
						{ ids },
					);
				}
			}

			async function deleteIncomingHasEdges(
				run: RunCypherFn,
				model: string,
				where: CleanedWhere[] | undefined,
			): Promise<void> {
				const relType = edgeTypeForChildLabel(model);
				const { cypher, params } = matchPrefix(model, where);
				await run(
					`${cypher}\nOPTIONAL MATCH (p)-[r:${relType}]->(n)\nDELETE r`,
					params,
				);
			}

			async function findOneRow(
				model: string,
				where: CleanedWhere[],
				select?: string[],
			): Promise<Record<string, unknown> | null> {
				const n = new Cypher.NamedNode("n");
				const pattern = new Cypher.Pattern(n, { labels: [model] });
				const { predicate, params: wp } = buildWherePredicate(
					n,
					where,
					allowedDbFieldsForModel(model),
				);
				const mq = (
					predicate
						? new Cypher.Match(pattern).where(predicate)
						: new Cypher.Match(pattern)
				)
					.return(n)
					.limit(1);
				const built = mq.build();
				const res = await runRead(built.cypher, {
					...built.params,
					...wp,
				});
				const node = res.records[0]?.get("n");
				if (!node || typeof node !== "object" || !("properties" in node)) {
					return null;
				}
				const dm = getDefaultModelName(model);
				return pickSelect(
					normalizeRow(dm, nodeToPlain(node as import("neo4j-driver").Node)),
					select,
					dm,
				);
			}

			async function countRows(
				model: string,
				where: CleanedWhere[] | undefined,
			): Promise<number> {
				const n = new Cypher.NamedNode("n");
				const pattern = new Cypher.Pattern(n, { labels: [model] });
				const { predicate, params: wp } = buildWherePredicate(
					n,
					where,
					allowedDbFieldsForModel(model),
				);
				const mq = (
					predicate
						? new Cypher.Match(pattern).where(predicate)
						: new Cypher.Match(pattern)
				).return([Cypher.count(n), "c"]);
				const built = mq.build();
				const res = await runRead(built.cypher, {
					...built.params,
					...wp,
				});
				const c = res.records[0]?.get("c");
				return typeof c === "number" ? c : Number(c ?? 0);
			}

			return {
				create: async <T extends Record<string, unknown>>({
					model,
					data,
				}: {
					model: string;
					data: T;
				}) => {
					return withOperationError(
						"create",
						withWriteTransaction(async (run) => {
							const dk = getDefaultModelName(model);
							const props = propsForNeo4j(data as Record<string, unknown>);
							const { cypher: createCy, params: createParams } = createNodeQuery(
								model,
								props,
							);
							const res = await run(createCy, createParams);
							const rec = res.records[0]?.get("n");
							if (!rec || typeof rec !== "object" || !("properties" in rec)) {
								throw new Error("neo4jAdapter: CREATE returned no node");
							}
							const row = nodeToPlain(rec as import("neo4j-driver").Node);
							for (const [k, v] of Object.entries(data)) {
								if (!(k in row) && (v === null || v === undefined)) {
									(row as Record<string, unknown>)[k] = null;
								}
							}
							normalizeRow(dk, row);
							const idKey = getFieldName({ model: dk, field: "id" });
							const childId = row[idKey];
							if (typeof childId === "string" || typeof childId === "number") {
								await mergeReferenceEdges(
									schema,
									getDefaultModelName,
									getModelName,
									getFieldName,
									dk,
									model,
									String(childId),
									row,
									async (c, p) => {
										await run(c, p);
									},
								);
							}
							return row as T;
						}),
					);
				},

				update: async <T>({
					model,
					where,
					update,
				}: {
					model: string;
					where: CleanedWhere[];
					update: T;
				}) => {
					return withOperationError(
						"update",
						withWriteTransaction(async (run) => {
							const dk = getDefaultModelName(model);
							const patch = propsForNeo4j(
								update as unknown as Record<string, unknown>,
							);
							if (Object.keys(patch).length === 0) {
								return (await findOneRow(model, where, undefined)) as T | null;
							}

							const { cypher: mc, params: mp } = matchPrefix(model, where);
							const patchParams: Record<string, unknown> = {};
							for (const [k, v] of Object.entries(patch)) {
								patchParams[k] = asNeo4jParameterValue(v);
							}
							const res = await run(`${mc} SET n += $patch RETURN n LIMIT 1`, {
								...mp,
								patch: patchParams,
							});
							const node = res.records[0]?.get("n");
							if (!node || typeof node !== "object" || !("properties" in node)) {
								return null;
							}
							const row = normalizeRow(
								dk,
								nodeToPlain(node as import("neo4j-driver").Node),
							);
							const idField = getFieldName({ model: dk, field: "id" });
							const childId = row[idField];
							if (childId !== undefined && childId !== null) {
								await updateReferenceEdges(
									schema,
									getDefaultModelName,
									getModelName,
									getFieldName,
									dk,
									model,
									String(childId),
									patch,
									async (c, p) => {
										await run(c, p);
									},
								);
							}
							return row as T;
						}),
					);
				},

				updateMany: async ({
					model,
					where,
					update,
				}: {
					model: string;
					where: CleanedWhere[];
					update: Record<string, unknown>;
				}) => {
					return withOperationError(
						"updateMany",
						(async () => {
							const patch = propsForNeo4j(update);
							if (Object.keys(patch).length === 0) {
								return countRows(model, where);
							}
							const { cypher: mc, params: mp } = matchPrefix(model, where);
							const patchParams: Record<string, unknown> = {};
							for (const [k, v] of Object.entries(patch)) {
								patchParams[k] = asNeo4jParameterValue(v);
							}
							const res = await runWrite(
								`${mc} SET n += $patch RETURN count(n) AS c`,
								{ ...mp, patch: patchParams },
							);
							const c = res.records[0]?.get("c");
							return typeof c === "number" ? c : Number(c ?? 0);
						})(),
					);
				},

				delete: async ({
					model,
					where,
				}: {
					model: string;
					where: CleanedWhere[];
				}) => {
					await withOperationError(
						"delete",
						withWriteTransaction(async (run) => {
							const dk = getDefaultModelName(model);
							if (dk === "user") {
								await cascadeDeleteChildrenForUsers(run, model, where);
							} else if (dk === "session" || dk === "account") {
								await deleteIncomingHasEdges(run, model, where);
							}
							const n = new Cypher.NamedNode("n");
							const pattern = new Cypher.Pattern(n, { labels: [model] });
							const { predicate, params: wp } = buildWherePredicate(
								n,
								where,
								allowedDbFieldsForModel(model),
							);
							const dq = (
								predicate
									? new Cypher.Match(pattern).where(predicate)
									: new Cypher.Match(pattern)
							).detachDelete(n);
							const built = dq.build();
							await run(built.cypher, { ...built.params, ...wp });
						}),
					);
				},

				deleteMany: async ({
					model,
					where,
				}: {
					model: string;
					where: CleanedWhere[];
				}) => {
					return withOperationError(
						"deleteMany",
						withWriteTransaction(async (run) => {
							const dk = getDefaultModelName(model);
							if (dk === "user") {
								await cascadeDeleteChildrenForUsers(run, model, where);
							} else if (dk === "session" || dk === "account") {
								await deleteIncomingHasEdges(run, model, where);
							}
							const n = new Cypher.NamedNode("n");
							const pattern = new Cypher.Pattern(n, { labels: [model] });
							const { predicate, params: wp } = buildWherePredicate(
								n,
								where,
								allowedDbFieldsForModel(model),
							);
							const dq = (
								predicate
									? new Cypher.Match(pattern).where(predicate)
									: new Cypher.Match(pattern)
							).detachDelete(n);
							const built = dq.build();
							const res = await run(built.cypher, {
								...built.params,
								...wp,
							});
							return res.summary.counters.updates().nodesDeleted ?? 0;
						}),
					);
				},

				findOne: async <T>({
					model,
					where,
					select,
					join: _join,
				}: {
					model: string;
					where: CleanedWhere[];
					select?: string[];
					join?: JoinConfig;
				}) => {
					void _join;
					return findOneRow(model, where, select) as Promise<T | null>;
				},

				findMany: async <T>({
					model,
					where,
					limit,
					sortBy,
					offset,
					select,
					join: _join,
				}: {
					model: string;
					where?: CleanedWhere[];
					limit: number;
					sortBy?: { field: string; direction: "asc" | "desc" };
					offset?: number;
					select?: string[];
					join?: JoinConfig;
				}) => {
					void _join;
					assertSortableField(model, sortBy);
					const n = new Cypher.NamedNode("n");
					const pattern = new Cypher.Pattern(n, { labels: [model] });
					const { predicate, params: wp } = buildWherePredicate(
						n,
						where,
						allowedDbFieldsForModel(model),
					);
					let chain: Cypher.Match = predicate
						? new Cypher.Match(pattern).where(predicate)
						: new Cypher.Match(pattern);
					if (sortBy) {
						const prop = n.property(sortBy.field);
						chain = chain.orderBy([
							prop,
							sortBy.direction === "desc" ? "DESC" : "ASC",
						]) as Cypher.Match;
					}
					if (offset !== undefined && offset > 0) {
						chain = chain.skip(offset) as Cypher.Match;
					}
					if (limit >= 0) {
						chain = chain.limit(limit) as Cypher.Match;
					}
					const built = chain.return(n).build();
					const res = await runRead(built.cypher, {
						...built.params,
						...wp,
					});
					const dm = getDefaultModelName(model);
					return res.records
						.map((r) => r.get("n"))
						.filter(Boolean)
						.map((node) =>
							pickSelect(
								normalizeRow(
									dm,
									nodeToPlain(node as import("neo4j-driver").Node),
								),
								select,
								dm,
							),
						) as T[];
				},

				count: async ({
					model,
					where,
				}: {
					model: string;
					where?: CleanedWhere[];
				}) => {
					return countRows(model, where);
				},

				createSchema: async ({ tables }) => {
					const { buildSchemaStatements } = await import("./migrations.js");
					const code = buildSchemaStatements(
						tables,
						(schemaKey) => getModelName(schemaKey),
						(args) => getFieldName(args),
					).join("\n");
					return {
						code,
						path: "neo4j-schema.cypher",
						append: false,
					};
				},
			};
		};

	let adapterOptions: AdapterFactoryOptions;

	adapterOptions = {
		config: {
			adapterId: "neo4j",
			adapterName: "Neo4j",
			usePlural: input.usePlural ?? false,
			debugLogs: input.debugLogs ?? false,
			supportsJSON: false,
			supportsDates: false,
			supportsBooleans: true,
			supportsArrays: true,
			transaction: async (cb) => {
				const run = async (s: Session) =>
					s.executeWrite(async (tx) => {
						if (!lazyOptions) {
							throw new Error("neo4jAdapter: adapter options not initialized");
						}
						const innerFactory = createAdapterFactory({
							config: adapterOptions.config,
							adapter: createInnerAdapter(tx),
						});
						return cb(innerFactory(lazyOptions) as Parameters<typeof cb>[0]);
					});
				if (input.session) return run(input.session);
				const s = driver!.session({ database });
				try {
					return await run(s);
				} finally {
					await s.close();
				}
			},
		},
		adapter: createInnerAdapter(undefined),
	};

	const factory = createAdapterFactory(adapterOptions);
	return (options: BetterAuthOptions) => {
		lazyOptions = options;
		return factory(options);
	};
}
