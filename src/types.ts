import type { DBAdapterDebugLogOption } from "better-auth/adapters";
import type { Driver, Session } from "neo4j-driver";

export interface Neo4jBetterAuthConfig {
	/**
	 * Shared driver (recommended). Each read/write uses a short-lived session (safe for concurrent callers).
	 * Pass {@link session} only if you need a single shared session (not concurrent).
	 */
	driver?: Driver;
	/**
	 * Optional Neo4j database name (multi-database).
	 */
	database?: string;
	/**
	 * Reuse an existing session instead of opening one from {@link driver}.
	 * You are responsible for closing it.
	 */
	session?: Session;
	usePlural?: boolean;
	debugLogs?: DBAdapterDebugLogOption;
}
