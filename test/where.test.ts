import { describe, expect, it } from "vitest";
import Cypher from "@neo4j/cypher-builder";
import { buildWherePredicate } from "../src/where.js";

describe("buildWherePredicate field validation", () => {
	it("rejects where field outside allowlist", () => {
		const n = new Cypher.NamedNode("n");
		expect(() =>
			buildWherePredicate(
				n,
				[{ field: "unknown", operator: "eq", value: "x" }],
				new Set(["id", "email"]),
			),
		).toThrow('neo4jAdapter: invalid where field "unknown"');
	});

	it("builds predicate for allowlisted field", () => {
		const n = new Cypher.NamedNode("n");
		const result = buildWherePredicate(
			n,
			[{ field: "email", operator: "eq", value: "a@b.c" }],
			new Set(["id", "email"]),
		);
		expect(result.predicate).toBeDefined();
		expect(Object.keys(result.params)).toHaveLength(1);
	});
});
