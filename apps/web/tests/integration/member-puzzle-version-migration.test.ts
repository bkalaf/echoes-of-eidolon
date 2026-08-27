import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(import.meta.dirname, "../../prisma/migrations/20260826120000_member_puzzle_production_versions/migration.sql"), "utf8");
const migrationVerifier = readFileSync(resolve(import.meta.dirname, "../../scripts/verify-migrations.mts"), "utf8");

describe("Member puzzle production-version migration", () => {
  it("appends four guarded immutable versions and eight authored hints without changing 1.0.0", () => {
    expect(migration).toContain("MEMBER_PUZZLE_VERSION_BLOCKER");
    expect(migration).toContain("base.\"design\"::jsonb || CASE");
    expect(migration).toContain("'1.1.0'");
    expect(migration).toContain("target_version_count <> 4 OR target_hint_count <> 8");
    expect(migration).not.toMatch(/UPDATE\s+"PuzzleBlueprintVersion"/i);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+"PuzzleBlueprintVersion"/i);
  });

  it("contains only the reviewed production IDs and public slugs", () => {
    for (const value of ["PZB-011", "PZB-012", "PZB-021", "PZB-037", "quiet-accord", "third-reading", "the-pall", "glass-vespers"]) expect(migration).toContain(value);
    expect(migration).not.toContain("PZB-001@1.1.0");
  });

  it("exercises both empty and populated forward-migration paths in disposable databases", () => {
    expect(migrationVerifier).toContain("Fresh migration unexpectedly manufactured Puzzle roots");
    expect(migrationVerifier).toContain('await applyThrough("20260820101500_taxonomy_relational_normalization")');
    expect(migrationVerifier).toContain('await applyThrough("20260826120000_member_puzzle_production_versions")');
    expect(migrationVerifier).toContain("Populated Puzzle upgrade did not append exactly four immutable versions and eight hints");
  });
});
