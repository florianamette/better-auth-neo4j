# neo4j-better-auth

Better Auth database adapter for [Neo4j](https://neo4j.com/).

The adapter maps Better Auth models to Neo4j node labels, stores model fields as node properties, and creates `HAS_*` relationship edges from foreign-key references (for example `User-[:HAS_SESSION]->Session`).

## Install

```bash
npm install neo4j-better-auth better-auth neo4j-driver @neo4j/cypher-builder
```

### Requirements

- Node.js `>=20`
- Peer dependencies:
  - `better-auth` `^1.5.0`
  - `neo4j-driver` `^5.0.0 || ^6.0.0`
  - `@neo4j/cypher-builder` `^3.0.1`

## Quick Start

```ts
import neo4j from "neo4j-driver";
import { betterAuth } from "better-auth";
import { neo4jAdapter } from "neo4j-better-auth";

const driver = neo4j.driver(
	process.env.NEO4J_URI!,
	neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!),
);

export const auth = betterAuth({
	database: neo4jAdapter({
		driver,
		database: process.env.NEO4J_DATABASE,
	}),
	emailAndPassword: {
		enabled: true,
	},
});
```

## Production Schema Setup

Before production, apply generated Neo4j constraints and indexes for your Better Auth schema.

Use exported helpers:
- `buildSchemaStatements(...)` to generate Cypher statements
- `runCypherMigration(...)` to execute statements

See the full guide and examples in [`docs/package.md`](docs/package.md).

## Example App

The [`example/`](example/) directory contains a Next.js app using:
- `better-auth`
- `neo4jAdapter(...)`
- Docker Neo4j

## Full Documentation

For full configuration, API behavior, filtering semantics, migration strategy, troubleshooting, and CI/release notes, read:

- [`docs/package.md`](docs/package.md)

## Contributing

Project development and release process are documented in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT
