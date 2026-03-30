import { testAdapter, normalTestSuite } from "@better-auth/test-utils/adapter";
import { getAuthTables } from "better-auth/db";
import { initGetFieldName, initGetModelName } from "better-auth/adapters";
import { Neo4jContainer } from "@testcontainers/neo4j";
import neo4j from "neo4j-driver";
import { neo4jAdapter, runCypherMigration } from "../src/index.js";

const started = await new Neo4jContainer("neo4j:5.26-community")
	.withStartupTimeout(120000)
	.start();

const driver = neo4j.driver(
	started.getBoltUri(),
	neo4j.auth.basic(started.getUsername(), started.getPassword()),
);

const { execute } = await testAdapter({
	adapter: async () => neo4jAdapter({ driver }),
	runMigrations: async (options) => {
		const session = driver.session();
		const tables = getAuthTables(options);
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
		} finally {
			await session.close();
		}
	},
	tests: [normalTestSuite()],
	onFinish: async () => {
		await driver.close();
		await started.stop();
	},
});

execute();
