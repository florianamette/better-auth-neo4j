import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import neo4j, { type Driver } from "neo4j-driver";
import { neo4jAdapter } from "neo4j-better-auth";

const globalForNeo4j = globalThis as typeof globalThis & {
	neo4jDriver?: Driver;
};

function getNeo4jDriver(): Driver {
	if (globalForNeo4j.neo4jDriver) {
		return globalForNeo4j.neo4jDriver;
	}
	const uri = process.env.NEO4J_URI;
	const user = process.env.NEO4J_USER;
	const password = process.env.NEO4J_PASSWORD;
	if (!uri || !user || password === undefined || password === "") {
		throw new Error(
			"Missing NEO4J_URI, NEO4J_USER, or NEO4J_PASSWORD (check .env.local)",
		);
	}
	globalForNeo4j.neo4jDriver = neo4j.driver(
		uri,
		neo4j.auth.basic(user, password),
	);
	return globalForNeo4j.neo4jDriver;
}

function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return v;
}

let authInstance: ReturnType<typeof betterAuth> | undefined;

/**
 * Lazy init so `next build` can analyze routes without `.env.local`.
 * First request (or db:schema script after dotenv) constructs Better Auth + Neo4j.
 */
export function getAuth(): ReturnType<typeof betterAuth> {
	if (authInstance) {
		return authInstance;
	}
	authInstance = betterAuth({
		secret: requireEnv("BETTER_AUTH_SECRET"),
		baseURL: requireEnv("BETTER_AUTH_URL"),
		database: neo4jAdapter({
			driver: getNeo4jDriver(),
			database: process.env.NEO4J_DATABASE,
		}),
		emailAndPassword: {
			enabled: true,
		},
		plugins: [nextCookies()],
	}) as unknown as ReturnType<typeof betterAuth>;
	return authInstance;
}
