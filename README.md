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

## Development

```bash
npm ci
npm run build
npm test
```

Tests use Docker (Testcontainers Neo4j), as on GitHub Actions.

## Releases (maintainers)

### Secret

In the GitHub repository: **Settings → Secrets and variables → Actions**, add:

- **`NPM_TOKEN`**: npm [automation token](https://docs.npmjs.com/creating-and-viewing-access-tokens) with permission to publish `neo4j-better-auth`.

### Publishing a version

1. Bump `version` in `package.json` (or run `npm version patch|minor|major`, which updates `package.json` and creates a git tag).
2. Ensure the git tag is exactly `v` + semver from `package.json`, for example `v0.2.0` for version `0.2.0`.
3. Push the commit and the tag, for example:

   ```bash
   git push origin main
   git push origin v0.2.0
   ```

The **Publish** workflow (on tag `v*`) runs tests, builds, publishes to [npmjs](https://www.npmjs.com/), and creates a **GitHub Release** with auto-generated notes.

If the tag does not match `package.json` (e.g. tag `v0.2.0` but version `0.1.0`), the workflow fails before publishing.

## License

MIT
