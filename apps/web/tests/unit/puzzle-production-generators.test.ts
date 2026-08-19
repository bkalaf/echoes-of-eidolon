import { describe, expect, it } from "vitest";

import {
  generateProductionPuzzle,
  getProductionGeneratorCatalog,
  getProductionPreviews,
  getPublicProductionPuzzle,
  productionFamilyKinds,
  solveProductionPuzzle,
  validateProductionPuzzle,
  validateProductionPreview,
} from "../../src/server/puzzle-production-generators";

const secret = "all-production-generator-test-secret-00000000000000000000";

describe("Witness Puzzle Box 70 production generators", () => {
  it("covers the exact 70 IDs, five tiers, and nine authored families", () => {
    const catalog = getProductionGeneratorCatalog();
    expect(catalog).toHaveLength(70);
    expect(catalog.map((entry) => entry.puzzleBlueprintId)).toEqual(Array.from({ length: 70 }, (_, index) => `PZB-${String(index + 1).padStart(3, "0")}`));
    expect(new Set(catalog.map((entry) => entry.primaryFamily))).toEqual(new Set(Object.keys(productionFamilyKinds)));
    for (const tier of ["TIER_1_INITIATE", "TIER_2_ADEPT", "TIER_3_EXPERT", "TIER_4_MASTER", "TIER_5_ORDEAL"]) {
      expect(catalog.filter((entry) => entry.difficultyTier === tier)).toHaveLength(14);
    }
  });

  it("deterministically generates, solves, and rejects decoys for all 70", () => {
    for (const entry of getProductionGeneratorCatalog()) {
      const input = { generatorVersion: entry.generatorVersion, puzzleBlueprintId: entry.puzzleBlueprintId, seed: "coverage-seed-01", subjectKey: "PLAYER-COVERAGE" };
      const generated = generateProductionPuzzle(input, secret);
      expect(generateProductionPuzzle(input, secret)).toEqual(generated);
      expect(generateProductionPuzzle({ ...input, seed: "coverage-seed-02" }, secret).instanceChecksum).not.toBe(generated.instanceChecksum);
      expect(solveProductionPuzzle(generated)).toEqual([generated.canonicalSolution]);
      expect(validateProductionPuzzle(generated, generated.canonicalSolution, secret)).toBe(true);
      expect(validateProductionPuzzle(generated, `${generated.canonicalSolution}DECOY`, secret)).toBe(false);
      expect(generated.generatorVersion).toBe(entry.generatorVersion);
      expect(generated.answerFormat).toBe(entry.answerFormat);
      expect(generated.concept).toBe(entry.concept);
      expect(generated.expectedSolvePath).toEqual(entry.expectedSolvePath);
      expect(generated.playerFacingModalities).toEqual(entry.playerFacingModalities);
      for (const decoy of entry.decoys) expect(validateProductionPuzzle(generated, decoy, secret)).toBe(false);
      expect(generated.uniqueSolution).toBe(true);
      expect(generated.alternateSolutionsRejected).toBe(true);
    }
  });

  it("returns only answer-free client projections with complete accessibility and hints", () => {
    for (const entry of getProductionGeneratorCatalog()) {
      const generated = generateProductionPuzzle({ generatorVersion: entry.generatorVersion, puzzleBlueprintId: entry.puzzleBlueprintId, seed: "coverage-seed-01", subjectKey: "PLAYER-COVERAGE" }, secret);
      const projection = getPublicProductionPuzzle(generated);
      const serialized = JSON.stringify(projection);
      expect(serialized).not.toContain(secret);
      expect(serialized).not.toContain("coverage-seed-01");
      expect(serialized).not.toMatch(/"(?:canonicalSolution|proofDigest|seed|subjectKey|validationToken)"\s*:/i);
      expect(projection.accessibilityModes).toEqual(entry.accessibilityModes);
      expect(projection.answerFormat).toBe(entry.answerFormat);
      expect(projection.concept).toBe(entry.concept);
      expect(projection.playerFacingModalities).toEqual(entry.playerFacingModalities);
      expect(projection.expectedSolvePath).toEqual(entry.expectedSolvePath);
      expect(projection.hints).toHaveLength(2);
      expect(projection.timerStarted).toBe(false);
      expect(projection.liveRuntimeRecordsCreated).toBe(0);
    }
  });

  it("uses nine distinct family carriers and claim-level declared citations for research", () => {
    const observed = new Set<string>();
    for (const entry of getProductionGeneratorCatalog()) {
      const generated = generateProductionPuzzle({ generatorVersion: entry.generatorVersion, puzzleBlueprintId: entry.puzzleBlueprintId, seed: "family-seed", subjectKey: "PLAYER-FAMILY" }, secret);
      observed.add(generated.familyKind);
      if (entry.primaryFamily === "HISTORICAL_RESEARCH") {
        expect(generated.carrier.kind).toBe("RESEARCH_CLAIM_CHAIN");
        if (generated.carrier.kind === "RESEARCH_CLAIM_CHAIN") {
          expect(generated.carrier.claims.length).toBeGreaterThan(0);
          expect(generated.carrier.claims.every((claim) => /^https:\/\//.test(claim.citation))).toBe(true);
        }
      }
    }
    expect(observed).toEqual(new Set(Object.values(productionFamilyKinds)));
  });

  it("serves all 70 answer-free administrator previews and validates them server-side", () => {
    const previews = getProductionPreviews(secret);
    expect(previews).toHaveLength(70);
    expect(previews.map((preview) => preview.puzzleBlueprintId)).toEqual(getProductionGeneratorCatalog().map((entry) => entry.puzzleBlueprintId));
    expect(previews.every((preview) => preview.timerStarted === false && preview.liveRuntimeRecordsCreated === 0)).toBe(true);
    expect(validateProductionPreview("PZB-001", "DECLARED-DECOY", secret)).toEqual({ correct: false, puzzleBlueprintId: "PZB-001", timerStarted: false });
    expect(() => validateProductionPreview("PZB-999", "anything", secret)).toThrow("Unknown production Puzzle Blueprint: PZB-999");
  });
});
