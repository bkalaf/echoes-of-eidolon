import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("persistence contract", () => {
  it("keeps the Prisma schema valid without requiring a live database", () => {
    const output = execFileSync("pnpm", ["exec", "prisma", "validate"], {
      cwd: resolve(import.meta.dirname, "../.."),
      encoding: "utf8",
    });
    expect(output).toContain("is valid");
  });

  it("persists closed-world cardinality and conservation guards", () => {
    const migration = readFileSync(
      resolve(
        import.meta.dirname,
        "../../prisma/migrations/20260810043000_initial/migration.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("Witness_distinct_antagonists_check");
    expect(migration).toContain("Companion_distinct_protagonists_check");
    expect(migration).toContain("BreedPopulation_nonnegative_check");
    expect(migration).toContain("PuzzleBlueprint_authored_hints_check");
  });
});
