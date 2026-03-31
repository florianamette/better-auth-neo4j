# Contributing to neo4j-better-auth

## Local development

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm test
```

Tests spin up Neo4j via **Testcontainers** (Docker required), similar to GitHub Actions.

## Continuous integration

Workflows live under `.github/workflows/`:

- **`ci.yml`** — on push and pull requests to `main` and `dev`: `pnpm install --frozen-lockfile`, `pnpm run build`, `pnpm test` (Node 24, `ubuntu-latest`).

## Releases (maintainers)

### npm Trusted Publishing

This repository publishes with npm Trusted Publishing (GitHub OIDC), not with an `NPM_TOKEN`.
Ensure npm package trusted publisher settings are configured for this repository/workflow.

### Stable releases from `main`

Releases are managed with Changesets.

1. Add a changeset in your branch:

   ```bash
   pnpm changeset
   ```

2. Merge into `main`.
3. The **Release Main** workflow (`publish.yml`) opens/updates a versioning PR.
4. Merge the versioning PR to publish to npm and create a GitHub Release.

The workflow:

- bumps `package.json` version from pending changesets
- publishes to npm with `latest` tag and provenance
- creates a GitHub release automatically

### Prereleases from `dev`

Pushes to `dev` trigger **Publish Dev** (`publish-dev.yml`):

- generates a snapshot version (`*-dev.*`)
- publishes to npm with `dev` dist-tag and provenance
- creates a GitHub prerelease

This is intended for testing integration builds before stable release on `main`.

### Manual publish from your machine

From the repo root (not `npm publish <package-name>`):

```bash
pnpm release
```

Local publishing is intended as break-glass only; prefer CI releases to preserve provenance and auditable trusted identity.
