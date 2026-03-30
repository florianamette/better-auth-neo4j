import type { CleanedWhere } from "@better-auth/core/db/adapter";
import Cypher, { in as opIn } from "@neo4j/cypher-builder";
import type { Predicate } from "@neo4j/cypher-builder";

export function buildWherePredicate(
	n: Cypher.NamedNode,
	where: CleanedWhere[] | undefined,
): { predicate?: Predicate; params: Record<string, unknown> } {
	if (!where?.length) return { params: {} };
	const params: Record<string, unknown> = {};
	let i = 0;
	const param = (val: unknown) => {
		const key = `w${i++}`;
		params[key] = val;
		return new Cypher.NamedParam(key, val);
	};

	const buildExpr = (w: CleanedWhere): Predicate => {
		const prop = n.property(w.field);
		const v = w.value;
		switch (w.operator) {
			case "eq":
				return v === null
					? Cypher.isNull(prop)
					: (Cypher.eq(prop, param(v)) as Predicate);
			case "ne":
				return v === null
					? Cypher.isNotNull(prop)
					: (Cypher.neq(prop, param(v)) as Predicate);
			case "lt":
				return Cypher.lt(prop, param(v)) as Predicate;
			case "lte":
				return Cypher.lte(prop, param(v)) as Predicate;
			case "gt":
				return Cypher.gt(prop, param(v)) as Predicate;
			case "gte":
				return Cypher.gte(prop, param(v)) as Predicate;
			case "in":
				return opIn(prop, param(v)) as Predicate;
			case "not_in":
				return Cypher.not(opIn(prop, param(v)) as Predicate);
			case "contains":
				return Cypher.contains(prop, param(String(v))) as Predicate;
			case "starts_with":
				return Cypher.startsWith(prop, param(String(v))) as Predicate;
			case "ends_with":
				return Cypher.endsWith(prop, param(String(v))) as Predicate;
			default:
				return v === null
					? Cypher.isNull(prop)
					: (Cypher.eq(prop, param(v)) as Predicate);
		}
	};

	let acc = buildExpr(where[0]!) as Predicate;
	for (let j = 1; j < where.length; j++) {
		const w = where[j]!;
		const next = buildExpr(w);
		const connector = w.connector ?? "AND";
		acc =
			connector === "OR"
				? (Cypher.or(acc, next) as Predicate)
				: (Cypher.and(acc, next) as Predicate);
	}

	return { predicate: acc, params };
}
