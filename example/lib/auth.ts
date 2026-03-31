import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import neo4j from "neo4j-driver";
import { neo4jAdapter } from "neo4j-better-auth";

const driver = neo4j.driver(
	process.env.NEO4J_URI ?? "bolt://localhost:7688",
	neo4j.auth.basic(
		process.env.NEO4J_USER ?? "neo4j",
		process.env.NEO4J_PASSWORD ?? "password",
	),
);

export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-32-chars-minimum",
	baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
	database: neo4jAdapter({
		driver,
		database: process.env.NEO4J_DATABASE,
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [nextCookies()],
}) as unknown as ReturnType<typeof betterAuth>;
