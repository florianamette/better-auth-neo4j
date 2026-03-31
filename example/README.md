# neo4j-better-auth — Next.js example

Minimal [Better Auth](https://better-auth.com) app using [neo4j-better-auth](https://www.npmjs.com/package/neo4j-better-auth) and Neo4j in Docker.

## Prerequisites

- Node.js 20+
- Docker (for Neo4j)

## 1. Build the adapter and install the example

From the **repository root**:

```bash
npm install
npm run build
```

Then install this app (the example depends on `neo4j-better-auth` via `file:..`):

```bash
cd example
npm install
```

## 2. Start Neo4j

From this directory:

```bash
docker compose up -d
```

Default credentials match `.env.example`: user `neo4j`, password `examplepassword`.  
Bolt: `bolt://localhost:7687`, Browser: http://localhost:7474

## 3. Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

- Set `BETTER_AUTH_SECRET` to a long random string (32+ characters).
- Align URLs with where you run Next (`BETTER_AUTH_URL` and `NEXT_PUBLIC_BETTER_AUTH_URL`, e.g. `http://localhost:3000`).

## 4. Apply Neo4j constraints / indexes

With Neo4j running and `.env.local` filled:

```bash
npm run db:schema
```

This uses the same Better Auth schema as [`lib/auth.ts`](lib/auth.ts) via [`runCypherMigration`](https://github.com/florianamette/better-auth-neo4j) from the adapter.

## 5. Run the app

```bash
npm run dev
```

Open http://localhost:3000 — sign up with email/password; data is stored as Neo4j nodes and relationship edges as described in the [Better Auth adapter guide](https://better-auth.com/docs/guides/create-a-db-adapter).

## Scripts

| Command        | Description                |
| -------------- | -------------------------- |
| `npm run dev`  | Next.js dev server         |
| `npm run build`| Production build           |
| `npm run db:schema` | Apply Neo4j constraints |

## Troubleshooting

- **`next build` warns about multiple lockfiles** — Next may detect the parent repo’s `package-lock.json`. You can ignore the warning, remove `example/package-lock.json` if npm recreated it and you only use the root install, or run installs only from `example/` so a single lockfile strategy matches your workflow.
- **`neo4j-better-auth` not resolved** — Run `npm run build` at the repository root so `dist/` exists; the example depends on `file:..`.

## Project layout

- [`lib/auth.ts`](lib/auth.ts) — `betterAuth` + `neo4jAdapter` + `nextCookies`
- [`lib/auth-client.ts`](lib/auth-client.ts) — `createAuthClient` for the browser
- [`app/api/auth/[...all]/route.ts`](app/api/auth/[...all]/route.ts) — Next.js route handler
- [`scripts/apply-neo4j-schema.ts`](scripts/apply-neo4j-schema.ts) — one-off schema migration
