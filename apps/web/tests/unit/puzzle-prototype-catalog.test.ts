import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PROTOTYPE_FAMILY_KINDS,
  getPublicPuzzlePrototypeCatalog,
  loadPuzzlePrototypeCatalog,
} from "../../src/domain/puzzle-prototype-catalog";

const catalogPath = resolve(import.meta.dirname, "../../data/puzzles/puzzle-prototype-catalog-70.json");

describe("70-puzzle prototype catalog", () => {
  const catalog = loadPuzzlePrototypeCatalog(JSON.parse(readFileSync(catalogPath, "utf8")));

  it("covers every approved blueprint exactly once across all five tiers and nine families", () => {
    expect(catalog).toHaveLength(70);
    expect(new Set(catalog.map((entry) => entry.puzzleBlueprintId)).size).toBe(70);
    expect(catalog.map((entry) => entry.puzzleBlueprintId)).toEqual(
      Array.from({ length: 70 }, (_, index) => `PZB-${String(index + 1).padStart(3, "0")}`),
    );
    expect(new Set(catalog.map((entry) => entry.prototypeKind))).toEqual(new Set(Object.values(PROTOTYPE_FAMILY_KINDS)));
    for (const tier of ["TIER_1_INITIATE", "TIER_2_ADEPT", "TIER_3_EXPERT", "TIER_4_MASTER", "TIER_5_ORDEAL"]) {
      expect(catalog.filter((entry) => entry.difficultyTier === tier)).toHaveLength(14);
    }
  });

  it("never exposes sample answers or solution walkthroughs through the client projection", () => {
    const publicCatalog = getPublicPuzzlePrototypeCatalog(catalog);
    expect(publicCatalog).toHaveLength(70);
    expect(JSON.stringify(publicCatalog)).not.toMatch(/sampleAnswer|canonicalAnswer|solutionWalkthrough/i);
    expect(publicCatalog.every((entry) => entry.controls.length > 0 && entry.decoys.length > 0)).toBe(true);
  });

  it("stores neither plaintext answers nor answer hashes", () => {
    expect(catalog.every((entry) => !("sampleAnswer" in entry) && !("answerHash" in entry) && !("canonicalAnswer" in entry))).toBe(true);
  });
});
