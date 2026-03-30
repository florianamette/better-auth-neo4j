import neo4j, { type Node, type Relationship } from "neo4j-driver";

function normalizeValue(v: unknown): unknown {
	if (neo4j.isInt(v)) {
		const n = v.toNumber();
		if (!Number.isSafeInteger(n)) return v.toString();
		return n;
	}
	if (Array.isArray(v)) return v.map(normalizeValue);
	if (neo4j.isNode(v)) return nodeToPlain(v);
	if (neo4j.isRelationship(v)) return relToPlain(v);
	if (v instanceof Date) return v;
	if (neo4j.isDateTime(v) || neo4j.isLocalDateTime(v) || neo4j.isDate(v)) {
		return v.toStandardDate();
	}
	if (v !== null && typeof v === "object") {
		const o = v as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const [k, val] of Object.entries(o)) {
			out[k] = normalizeValue(val);
		}
		return out;
	}
	return v;
}

export function nodeToPlain(node: Node): Record<string, unknown> {
	const props: Record<string, unknown> = {};
	for (const [k, val] of Object.entries(node.properties)) {
		props[k] = normalizeValue(val);
	}
	return props;
}

function relToPlain(rel: Relationship): Record<string, unknown> {
	const props: Record<string, unknown> = {};
	for (const [k, val] of Object.entries(rel.properties)) {
		props[k] = normalizeValue(val);
	}
	return props;
}

/**
 * Neo4j node properties must be primitives or arrays of primitives (no nested maps).
 * Objects are JSON-stringified; Better Auth is configured with supportsJSON: false for parsing.
 */
export function propsForNeo4j(data: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(data)) {
		if (v === undefined) continue;
		out[k] = serializeNeo4jPropertyValue(v);
	}
	return out;
}

function serializeNeo4jPropertyValue(v: unknown): unknown {
	if (v === null) return null;
	if (neo4j.isInt(v)) {
		const n = v.toNumber();
		return Number.isSafeInteger(n) ? n : v.toString();
	}
	if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
		return v;
	if (v instanceof Date) return v.toISOString();
	if (Array.isArray(v)) {
		return v.map((x) => serializeNeo4jPropertyValue(x));
	}
	if (v instanceof Map) {
		return JSON.stringify(Object.fromEntries(v));
	}
	if (typeof v === "object") {
		return JSON.stringify(v);
	}
	return String(v);
}

/** Last-resort coercion for driver parameters (avoids nested Map{} rejection). */
export function asNeo4jParameterValue(v: unknown): unknown {
	if (v === null) return null;
	if (neo4j.isInt(v)) {
		const n = v.toNumber();
		return Number.isSafeInteger(n) ? n : v.toString();
	}
	if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
		return v;
	if (v instanceof Date) return v.toISOString();
	if (Array.isArray(v)) return v.map((x) => asNeo4jParameterValue(x));
	if (typeof v === "object") return JSON.stringify(v);
	return String(v);
}
