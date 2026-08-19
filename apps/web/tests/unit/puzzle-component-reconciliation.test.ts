import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parsePuzzleBlueprintPackageCsv, PUZZLE_BLUEPRINT_PACKAGE_SHA256 } from "../../src/domain/puzzle-blueprint-package";

interface ReconciliationRow {
  decision: "LOCAL_COMPOSITION" | "REUSE_MASTER_COMPONENT" | "DEFER_PHASE_2" | "REJECT_PHASE_BOUNDARY";
  handle: string;
  occurrences: number;
  owner: string;
}

interface PhaseOneReview {
  componentReconciliation: {
    distinctHandles: number;
    masterAuthority: { components: string[]; source: string };
    sourceOccurrences: number;
    rows: ReconciliationRow[];
  };
  inputs: Array<{ path?: string; sha256?: string }>;
}

describe("Puzzle component proposal reconciliation", () => {
  it("accounts for every PUZCMP handle without creating a second permanent registry", () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../../..");
    const csvPath = resolve(repositoryRoot, "apps/web/data/puzzles/puzzle-blueprint-bank-70.csv");
    const rows = parsePuzzleBlueprintPackageCsv(readFileSync(csvPath, "utf8"));
    const occurrences = new Map<string, number>();
    for (const row of rows) {
      for (const handle of row.reusableComponentRequirementIds.split("|").map((value) => value.trim()).filter(Boolean)) {
        occurrences.set(handle, (occurrences.get(handle) ?? 0) + 1);
      }
    }

    const report = JSON.parse(readFileSync(resolve(repositoryRoot, "artifacts/release-0.3.0/puzzles/puzzle-phase1-review.json"), "utf8")) as PhaseOneReview;
    expect(report.inputs).toContainEqual(expect.objectContaining({ path: "apps/web/data/puzzles/puzzle-blueprint-bank-70.csv", sha256: PUZZLE_BLUEPRINT_PACKAGE_SHA256 }));
    expect(report.componentReconciliation.masterAuthority).toEqual({
      components: ["Top Bar", "Data Table", "Lookup Control", "Modal", "Map View", "Globe View"],
      source: "apps/web/src/screens/tools/ToolsPage.tsx#libraryComponents",
    });
    expect(report.componentReconciliation.distinctHandles).toBe(30);
    expect(report.componentReconciliation.sourceOccurrences).toBe(552);
    expect(report.componentReconciliation.rows.map((row) => row.handle).sort()).toEqual([...occurrences.keys()].sort());
    for (const row of report.componentReconciliation.rows) {
      expect(row.occurrences).toBe(occurrences.get(row.handle));
      expect(row.owner).not.toMatch(/registry/i);
    }
    expect(JSON.stringify(report.componentReconciliation)).not.toMatch(/ADD_(?:TO|SECOND)_REGISTRY/);
  });
});
