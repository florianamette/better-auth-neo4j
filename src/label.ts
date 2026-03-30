/** Backtick-wrap a Neo4j label or property key from Better Auth model / field names. */
export function escapeIdentifier(id: string): string {
	return "`" + id.replace(/`/g, "") + "`";
}

/** Relationship types must match [A-Z][A-Z0-9_]* */
export function edgeTypeForChildLabel(childLabel: string): string {
	const core = childLabel
		.replace(/[^a-zA-Z0-9]/g, "_")
		.toUpperCase()
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "");
	return `HAS_${core || "RELATED"}`;
}
