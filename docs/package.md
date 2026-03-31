# neo4j-better-auth package documentation

Comprehensive reference for the `neo4j-better-auth` adapter package.

## Table of contents

- [Overview](#overview)
- [Compatibility and requirements](#compatibility-and-requirements)
- [Installation](#installation)
- [Architecture and data model](#architecture-and-data-model)
- [Configuration](#configuration)
- [Exports](#exports)
- [Adapter behavior reference](#adapter-behavior-reference)
- [Filtering and where operators](#filtering-and-where-operators)
- [Migrations and schema management](#migrations-and-schema-management)
- [Data type serialization and normalization](#data-type-serialization-and-normalization)
- [Usage examples](#usage-examples)
- [Testing and local development](#testing-and-local-development)
- [CI and publishing](#ci-and-publishing)
- [Troubleshooting and limitations](#troubleshooting-and-limitations)

## Overview

`neo4j-better-auth` is a Better Auth database adapter that stores auth models in Neo4j.

If you only need setup in a few minutes, start with the quickstart in [`README.md`](../README.md), then return here for full operational details.

Core behavior:

- one Neo4j label per Better Auth model
- one node property per persisted field
- relationship edges derived from reference fields

At runtime, the adapter is built with `createAdapterFactory(...)` and supports Better Auth core operations like `create`, `findOne`, `findMany`, `update`, `delete`, and transactions.

## Compatibility and requirements

- Node.js: `>=20`
- Better Auth: `^1.5.0`
- Neo4j driver: `^5.0.0 || ^6.0.0`
- `@neo4j/cypher-builder`: `^3.0.1`

Package format:

- ESM and CJS exports are provided through package `exports`.
- Type declarations are included in `dist`.

## Installation

```bash
npm install neo4j-better-auth better-auth neo4j-driver @neo4j/cypher-builder
```

## Architecture and data model

### Labels and properties

- Better Auth model names map to Neo4j labels.
- Fields map to node properties using Better Auth field-name resolution (`getFieldName`).
- The `id` field is treated as the primary identifier for node uniqueness and relationship wiring.

### Reference edges

Reference fields (`references`) create and maintain directional edges:

- edge type is generated from child model label: `HAS_<CHILD_LABEL>`
- example: child label `Session` -> edge type `HAS_SESSION`
- edge wiring occurs on create and on update when referenced FK fields change

### Cascade-like deletion behavior

The adapter includes targeted cleanup behavior:

- deleting `user`: deletes cascade child nodes that reference user with `onDelete: cascade`
- deleting `session` or `account`: removes incoming `HAS_*` edges before node deletion

## Configuration

The adapter accepts `Neo4jBetterAuthConfig`:

```ts
export interface Neo4jBetterAuthConfig {
	driver?: Driver;
	database?: string;
	session?: Session;
	usePlural?: boolean;
	debugLogs?: DBAdapterDebugLogOption;
}
```

### Option semantics

- `driver`:
  - recommended
  - adapter opens short-lived sessions per operation
  - concurrency-safe default path
- `session`:
  - reuse a caller-managed session
  - caller is responsible for lifecycle/closing
  - less suitable for concurrent callers
- `database`:
  - optional Neo4j database name for multi-database setups
- `usePlural`:
  - forwarded to Better Auth naming behavior
- `debugLogs`:
  - forwards Better Auth adapter debug logging option
  - should remain disabled in production unless logs are tightly controlled

Validation rule:

- at least one of `driver` or `session` must be provided, otherwise initialization throws.

## Exports

The package exports:

- `neo4jAdapter`
- `Neo4jBetterAuthConfig` (type)
- `buildSchemaStatements`
- `runCypherMigration`
- `MigrationRunner` (type)

## Adapter behavior reference

This section describes operational behavior implemented by the adapter.

### `create`

- converts input data into Neo4j-compatible properties
- creates node with model label
- normalizes optional-returned-null fields
- resolves child `id` and creates FK-driven `HAS_*` edges
- returns plain object representation of created node

### `update`

- builds patch object from provided update data
- no-op update returns existing matching row
- applies `SET n += $patch` and returns first updated node
- if reference FK fields changed, rewires related edges

### `updateMany`

- applies patch to all matched nodes
- returns affected count (`count(n)`)
- no-op patch returns matched row count

### `delete`

- for `user`: performs cascade child deletion first
- for `session` and `account`: removes incoming `HAS_*` edges first
- performs `DETACH DELETE` for matched node(s)

### `deleteMany`

- same pre-delete handling as `delete`
- performs match + `DETACH DELETE`
- returns deleted node count from Neo4j summary counters

### `findOne`

- matches by `where`
- returns first result (`LIMIT 1`) or `null`
- applies `select` filtering using schema-to-db field mapping
- excludes fields marked `returned: false`

### `findMany`

- supports:
  - optional `where`
  - `sortBy` single-field direction
  - `offset` (`SKIP`)
  - `limit` (`LIMIT`)
  - `select`
- returns array of mapped plain objects
- excludes fields marked `returned: false`
- rejects unknown `sortBy.field` values with `neo4jAdapter: invalid sort field "<field>"`

### `count`

- returns `count(n)` for matched rows

### `createSchema`

- generates concatenated Cypher text from `buildSchemaStatements(...)`
- returns:
  - `code` as generated statements
  - `path: "neo4j-schema.cypher"`
  - `append: false`

### Transactions

The adapter advertises Better Auth transaction support and runs callback logic inside Neo4j write transactions.

Behavior:

- with shared `session`: runs write transaction on that session
- with `driver`: opens/uses short-lived session for transaction scope

## Filtering and where operators

`where` clauses are converted to Cypher predicates through `buildWherePredicate(...)`.

Field validation:

- `where.field` must match a DB field declared in the Better Auth schema for the queried model
- unknown fields are rejected with `neo4jAdapter: invalid where field "<field>"`

Supported operators:

- `eq`
- `ne`
- `lt`
- `lte`
- `gt`
- `gte`
- `in`
- `not_in`
- `contains`
- `starts_with`
- `ends_with`

Connector behavior:

- each additional condition can specify connector
- default connector is `AND`
- `OR` is supported

Null behavior:

- `eq null` maps to `IS NULL`
- `ne null` maps to `IS NOT NULL`

## Migrations and schema management

The package includes migration helpers to build and run Cypher schema statements for Better Auth tables.

### `buildSchemaStatements(...)`

Generates per-model statements:

- unique constraint for `id`
- unique constraints for fields marked `unique`
- indexes for fields marked `index`

Constraints/indexes use `IF NOT EXISTS` and sanitized names.

### `runCypherMigration(...)`

Sequentially executes each generated statement using your provided runner function:

```ts
type MigrationRunner = (
	cypher: string,
	params?: Record<string, unknown>,
) => Promise<void>;
```

### Recommended production workflow

1. Build Better Auth table schema.
2. Resolve model/field naming with `initGetModelName` and `initGetFieldName`.
3. Generate statements via `buildSchemaStatements` or call `runCypherMigration`.
4. Execute before serving production traffic.

## Data type serialization and normalization

Neo4j node properties only support primitive-like values and arrays. The adapter handles conversion.

### Write path conversion

- `undefined` fields: omitted
- `Date`: ISO string
- Neo4j integer:
  - safe integer -> JS number
  - unsafe integer -> string
- objects and maps: JSON stringified

### Read path normalization

- Neo4j integers normalized to number/string depending on safety
- Neo4j date-like values converted to JS `Date`
- nested arrays/objects normalized recursively

Important note:

- adapter capability flags currently set `supportsJSON: false` and `supportsDates: false`
- data may still be serialized/deserialized, but Better Auth should not assume native JSON/date column support

## Usage examples

### 1) Basic adapter setup

```ts
import neo4j from "neo4j-driver";
import { betterAuth } from "better-auth";
import { neo4jAdapter } from "neo4j-better-auth";

const driver = neo4j.driver(
	process.env.NEO4J_URI!,
	neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!),
);

export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET!,
	database: neo4jAdapter({
		driver,
		database: process.env.NEO4J_DATABASE,
	}),
	emailAndPassword: {
		enabled: true,
	},
});
```

### 2) Apply schema statements

```ts
import { getAuthTables } from "better-auth/db";
import { initGetFieldName, initGetModelName } from "better-auth/adapters";
import { runCypherMigration } from "neo4j-better-auth";

const tables = getAuthTables(authOptions);
const getModelName = initGetModelName({ schema: tables, usePlural: false });
const getFieldName = initGetFieldName({ schema: tables, usePlural: false });

await runCypherMigration(
	async (cypher) => {
		await session.run(cypher);
	},
	tables,
	(schemaKey) => getModelName(schemaKey),
	(args) => getFieldName(args),
);
```

### 3) Shared session mode (advanced)

```ts
const session = driver.session({ database: "neo4j" });

const adapter = neo4jAdapter({ session });
// caller is responsible for session lifecycle
```

## Testing and local development

Repository scripts:

- `npm run build`
- `npm test`

Tests use:

- `vitest`
- `@better-auth/test-utils`
- `@testcontainers/neo4j`

The integration test suite spins a Neo4j container and runs Better Auth adapter tests against the real database behavior.

## CI and publishing

### CI workflow

The CI workflow runs on pushes and pull requests to `main` and executes:

1. install dependencies
2. build
3. test

### Publish workflow

Publishing is handled by GitHub Actions with Changesets and npm Trusted Publishing (OIDC + provenance).

Current workflow behavior should be verified against:

- `.github/workflows/publish.yml`
- `CONTRIBUTING.md`

If your release process depends on tags or version matching, keep workflow triggers and docs aligned.

## Troubleshooting and limitations

### Common issues

- `neo4jAdapter: provide driver or session`
  - pass `driver` (recommended) or `session`
- concurrent transaction/session errors
  - prefer `driver` mode for per-operation short-lived sessions
- query mismatch due to model/field naming
  - ensure Better Auth naming resolvers are used consistently in migrations and runtime
- invalid `where` / `sortBy` field
  - adapter now validates fields against schema-derived DB field names and rejects unknown fields

### Current limitations / behavior notes

- `join` arguments are currently accepted but not implemented for relation expansion in query methods.
- Neo4j JSON/date behavior is serialized/coerced and not treated as native JSON/date column support by adapter capability flags.
- Relationship edges are only managed for reference fields present in schema metadata.

