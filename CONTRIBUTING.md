# Contributing to neo4j-better-auth

## Local development

```bash
npm ci
npm run build
npm test
```

Tests spin up Neo4j via **Testcontainers** (Docker required), similar to GitHub Actions.

## Continuous integration

Workflows live under `.github/workflows/`:

- **`ci.yml`** — on push and pull requests to `main`: `npm ci`, `npm run build`, `npm test` (Node 20, `ubuntu-latest`).

## Releases (maintainers)

### npm secret

In the GitHub repository: **Settings → Secrets and variables → Actions**, add:

- **`NPM_TOKEN`**: npm [automation token](https://docs.npmjs.com/creating-and-viewing-access-tokens) with permission to publish `neo4j-better-auth`.

### Publishing a version

1. Bump `version` in `package.json` (or run `npm version patch|minor|major`, which updates `package.json` and creates a git tag).
2. The git tag must be exactly `v` + the semver in `package.json` (e.g. `v0.2.0` for version `0.2.0`).
3. Push the commit and the tag:

   ```bash
   git push origin main
   git push origin v0.2.0
   ```

The **Publish** workflow (`publish.yml`, trigger: tag `v*`) runs tests, builds, runs `npm publish --access public`, and creates a **GitHub Release** with auto-generated notes.

If the tag does not match `package.json`, the workflow fails before publishing.

### Manual publish from your machine

From the repo root (not `npm publish <package-name>`):

```bash
npm publish --access public
```
