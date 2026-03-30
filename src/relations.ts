import type { BetterAuthDBSchema, DBFieldAttribute } from "better-auth/db";
import { edgeTypeForChildLabel, escapeIdentifier } from "./label.js";

type RunFn = (
	cypher: string,
	params?: Record<string, unknown>,
) => Promise<void>;

/** MERGE (parent)-[:HAS_*]->(child) for each FK present in `data`. */
export async function mergeReferenceEdges(
	schema: BetterAuthDBSchema,
	getDefaultModelName: (m: string) => string,
	getModelName: (m: string) => string,
	getFieldName: (args: { model: string; field: string }) => string,
	childDefaultKey: string,
	childDbLabel: string,
	childId: string,
	data: Record<string, unknown>,
	run: RunFn,
): Promise<void> {
	const table = schema[childDefaultKey];
	if (!table?.fields) return;

	for (const [fieldKey, attr] of Object.entries(table.fields) as [
		string,
		DBFieldAttribute,
	][]) {
		if (!attr.references) continue;
		const fkProp = getFieldName({ model: childDefaultKey, field: fieldKey });
		const fkVal = data[fkProp];
		if (fkVal === undefined || fkVal === null) continue;

		const parentKey = getDefaultModelName(attr.references.model);
		const parentLabel = getModelName(parentKey);
		const refField = attr.references.field;
		const parentIdProp = getFieldName({ model: parentKey, field: refField });

		const relType = edgeTypeForChildLabel(childDbLabel);
		const pl = escapeIdentifier(parentLabel);
		const cl = escapeIdentifier(childDbLabel);
		const childIdProp = escapeIdentifier(
			getFieldName({ model: childDefaultKey, field: "id" }),
		);

		await run(
			`
MATCH (parent:${pl} { ${escapeIdentifier(parentIdProp)}: $parentId })
MATCH (child:${cl} { ${childIdProp}: $childId })
MERGE (parent)-[:${relType}]->(child)
`.trim(),
			{ parentId: fkVal, childId },
		);
	}
}

/** Rewire edges when FK fields change. */
export async function updateReferenceEdges(
	schema: BetterAuthDBSchema,
	getDefaultModelName: (m: string) => string,
	getModelName: (m: string) => string,
	getFieldName: (args: { model: string; field: string }) => string,
	childDefaultKey: string,
	childDbLabel: string,
	childId: string,
	update: Record<string, unknown>,
	run: RunFn,
): Promise<void> {
	const table = schema[childDefaultKey];
	if (!table?.fields) return;

	for (const [fieldKey, attr] of Object.entries(table.fields) as [
		string,
		DBFieldAttribute,
	][]) {
		if (!attr.references) continue;
		const fkProp = getFieldName({ model: childDefaultKey, field: fieldKey });
		if (!(fkProp in update)) continue;
		const fkVal = update[fkProp];
		const relType = edgeTypeForChildLabel(childDbLabel);
		const parentKey = getDefaultModelName(attr.references.model);
		const parentLabel = getModelName(parentKey);
		const parentIdProp = getFieldName({
			model: parentKey,
			field: attr.references.field,
		});
		const pl = escapeIdentifier(parentLabel);
		const cl = escapeIdentifier(childDbLabel);
		const childIdProp = escapeIdentifier(
			getFieldName({ model: childDefaultKey, field: "id" }),
		);

		await run(
			`
MATCH (child:${cl} { ${childIdProp}: $childId })
OPTIONAL MATCH (old)-[r:${relType}]->(child)
DELETE r
`.trim(),
			{ childId },
		);

		if (fkVal !== undefined && fkVal !== null) {
			await run(
				`
MATCH (child:${cl} { ${childIdProp}: $childId })
MATCH (parent:${pl} { ${escapeIdentifier(parentIdProp)}: $parentId })
MERGE (parent)-[:${relType}]->(child)
`.trim(),
				{ childId, parentId: fkVal },
			);
		}
	}
}

export function listCascadeChildTargets(
	schema: BetterAuthDBSchema,
	parentDefaultKey: string,
	getDefaultModelName: (m: string) => string,
	getModelName: (m: string) => string,
	getFieldName: (args: { model: string; field: string }) => string,
): { childLabel: string; fkProp: string }[] {
	const out: { childLabel: string; fkProp: string }[] = [];

	for (const childDefaultKey of Object.keys(schema)) {
		const table = schema[childDefaultKey];
		if (!table?.fields) continue;
		for (const [fieldKey, attr] of Object.entries(table.fields) as [
			string,
			DBFieldAttribute,
		][]) {
			if (!attr.references) continue;
			if (getDefaultModelName(attr.references.model) !== parentDefaultKey)
				continue;
			const onDel = attr.references.onDelete ?? "cascade";
			if (onDel !== "cascade") continue;
			out.push({
				childLabel: getModelName(childDefaultKey),
				fkProp: getFieldName({ model: childDefaultKey, field: fieldKey }),
			});
		}
	}

	return out;
}
