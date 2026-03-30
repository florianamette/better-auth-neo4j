import type { BetterAuthDBSchema, DBFieldAttribute } from "better-auth/db";

export type MigrationRunner = (
	cypher: string,
	params?: Record<string, unknown>,
) => Promise<void>;

function cypherIdent(s: string): string {
	if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) return s;
	return "`" + s.replace(/`/g, "") + "`";
}

/** Build Cypher constraint / index statements for the current Better Auth schema. */
export function buildSchemaStatements(
	tables: BetterAuthDBSchema,
	getModelName: (schemaKey: string) => string,
	getFieldName: (args: { model: string; field: string }) => string,
): string[] {
	const lines: string[] = [];

	for (const [schemaKey, table] of Object.entries(tables)) {
		if (!table?.fields) continue;
		const label = cypherIdent(getModelName(schemaKey));
		const idProp = cypherIdent(
			getFieldName({ model: schemaKey, field: "id" }),
		);
		const constraintName = sanitizeName(`${getModelName(schemaKey)}_id_unique`);
		lines.push(
			`CREATE CONSTRAINT ${cypherIdent(constraintName)} IF NOT EXISTS FOR (n:${label}) REQUIRE n.${idProp} IS UNIQUE`,
		);

		for (const [fieldKey, attr] of Object.entries(table.fields) as [
			string,
			DBFieldAttribute,
		][]) {
			if (fieldKey === "id") continue;
			const propName = getFieldName({ model: schemaKey, field: fieldKey });
			const prop = cypherIdent(propName);
			if (attr.unique) {
				const name = sanitizeName(
					`${getModelName(schemaKey)}_${propName}_unique`,
				);
				lines.push(
					`CREATE CONSTRAINT ${cypherIdent(name)} IF NOT EXISTS FOR (n:${label}) REQUIRE n.${prop} IS UNIQUE`,
				);
			} else if (attr.index) {
				const name = sanitizeName(`${getModelName(schemaKey)}_${propName}_idx`);
				lines.push(
					`CREATE INDEX ${cypherIdent(name)} IF NOT EXISTS FOR (n:${label}) ON (n.${prop})`,
				);
			}
		}
	}

	return lines;
}

function sanitizeName(s: string): string {
	return s.replace(/[^a-zA-Z0-9_]/g, "_");
}

export async function runCypherMigration(
	run: MigrationRunner,
	tables: BetterAuthDBSchema,
	getModelName: (schemaKey: string) => string,
	getFieldName: (args: { model: string; field: string }) => string,
): Promise<void> {
	for (const line of buildSchemaStatements(tables, getModelName, getFieldName)) {
		await run(line);
	}
}
