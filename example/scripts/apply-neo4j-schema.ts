import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAuthTables } from "better-auth/db";
import { initGetFieldName, initGetModelName } from "better-auth/adapters";
import neo4j from "neo4j-driver";
import { runCypherMigration } from "neo4j-better-auth";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
config({ path: resolve(root, ".env.local") });
config({ path: resolve(root, ".env") });

async function main() {
	const uri = process.env.NEO4J_URI;
	const user = process.env.NEO4J_USER;
	const password = process.env.NEO4J_PASSWORD;
	if (!uri || !user || password === undefined || password === "") {
		console.error("Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD in .env.local");
		process.exit(1);
	}

	const { getAuth } = await import("../lib/auth");
	const tables = getAuthTables(getAuth().options);

	const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
	const session = driver.session({
		database: process.env.NEO4J_DATABASE,
	});

	const getModelName = initGetModelName({
		schema: tables,
		usePlural: false,
	});
	const getFieldName = initGetFieldName({
		schema: tables,
		usePlural: false,
	});

	try {
		await runCypherMigration(
			async (cypher) => {
				await session.run(cypher);
			},
			tables,
			(schemaKey) => getModelName(schemaKey),
			(args) => getFieldName(args),
		);
		console.log("Neo4j constraints/indexes applied.");
	} finally {
		await session.close();
		await driver.close();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
