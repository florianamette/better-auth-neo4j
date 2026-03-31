# neo4j-better-auth

Better Auth database adapter for [Neo4j](https://neo4j.com/): one node label per model, properties aligned with the Better Auth schema, and relationship edges derived from `references` on fields (for example `User`–`HAS_SESSION`→`Session`).

Built with [`createAdapterFactory`](https://better-auth.com/docs/guides/create-a-db-adapter), [`neo4j-driver`](https://www.npmjs.com/package/neo4j-driver), and [@neo4j/cypher-builder](https://github.com/neo4j/cypher-builder).

## Install

```bash
npm install neo4j-better-auth better-auth neo4j-driver @neo4j/cypher-builder
```

Peer dependencies: `better-auth`, `neo4j-driver`, `@neo4j/cypher-builder` (see `package.json` for supported ranges).

## Usage

```ts
import neo4j from "neo4j-driver";
import { betterAuth } from "better-auth";
import { neo4jAdapter } from "neo4j-better-auth";

const driver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!),
);

export const auth = betterAuth({
  database: neo4jAdapter({ driver, database: "neo4j" }),
});
```

Apply uniqueness constraints / indexes generated for your schema (see `buildSchemaStatements` / `runCypherMigration` in the package exports) before going to production.

## Example (Next.js + Docker Neo4j)

See the [`example/`](example/) app: Better Auth, `neo4jAdapter`, Docker Compose for Neo4j, and `npm run db:schema`.

## Contributing

Development setup, tests, CI, and release process: **[CONTRIBUTING.md](https://github.com/florianamette/better-auth-neo4j/blob/main/CONTRIBUTING.md)** in the repository.

## License

MIT
