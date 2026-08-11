import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../../prisma/reference/atlas-naming-proximity-supplement-v1.json"));
const importerSource = readFileSync(resolve(import.meta.dirname, "../../src/server/atlas-naming.ts"), "utf8");
const supplement = JSON.parse(source.toString("utf8")) as {
  bySettlementSiteId: Record<string, { eligibleEntityCount: number; eligibleNameableEntities: unknown[]; siteId: string }>;
  nameableEntities: Array<{ entityId: string }>;
  sourceSummary: { settlementCandidateCount: number; totalNameableEntityCount: number };
};

describe("bundled Atlas naming/proximity authority", () => {
  it("is the exact validated owner artifact rather than a truncated projection", () => {
    expect(createHash("sha256").update(source).digest("hex")).toBe("df12606c3d127b5f30a64205888a058bfea5866f5c07dce959f266765f18b922");
    expect(supplement.sourceSummary).toMatchObject({ settlementCandidateCount: 400, totalNameableEntityCount: 356 });
    expect(Object.keys(supplement.bySettlementSiteId)).toHaveLength(400);
    expect(supplement.nameableEntities).toHaveLength(356);
    expect(new Set(supplement.nameableEntities.map((entity) => entity.entityId)).size).toBe(356);
    expect(Object.values(supplement.bySettlementSiteId).every((entry) => entry.eligibleEntityCount === entry.eligibleNameableEntities.length)).toBe(true);
  });

  it("keeps the production-sized atomic import within an explicit bounded transaction", () => {
    expect(importerSource).toContain("{ timeout: 120_000 }");
  });
});
