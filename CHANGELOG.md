# neo4j-better-auth

## 0.1.1

### Patch Changes

- 12eca7b: Harden the Neo4j adapter by improving transaction atomicity for multi-step writes, validating `where` and `sortBy` fields against schema-derived DB fields, and normalizing operational error handling.

  Also improves release workflow robustness by aligning CI/runtime settings and dependency-audit coverage.
