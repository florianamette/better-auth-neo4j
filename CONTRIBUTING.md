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

- **`quality-reusable.yml`** — reusable quality gate: install, build, test (Node 24, pnpm 9.15.9).
- **`ci.yml`** — on push and pull requests to `main` and `dev`: runs `quality-reusable.yml`.
- **`publish.yml`** — manual-only fallback publish workflow: runs quality, then publishes package(s) with provenance.
- **`release.yml`** — on `main` (or manual): runs quality, then `changesets/action` to create/update release PRs and publish.

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
3. The **Release** workflow (`release.yml`) opens/updates a versioning PR.
4. Merge the versioning PR to publish to npm and create a GitHub Release.

The workflow:

- bumps `package.json` version from pending changesets
- publishes to npm with `latest` tag and provenance
- creates a GitHub release automatically

### Manual publish from your machine

From the repo root (not `npm publish <package-name>`):

```bash
pnpm release
```

Local publishing is intended as break-glass only; prefer CI releases to preserve provenance and auditable trusted identity.

### Manual publish via GitHub Actions (fallback)

Use **`publish.yml`** only for exceptional/manual recovery scenarios.
Normal releases should go through **`release.yml`** from `main`.
