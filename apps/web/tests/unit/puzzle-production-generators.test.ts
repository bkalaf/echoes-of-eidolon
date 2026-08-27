import { describe, expect, it } from "vitest";

import {
  generateProductionPuzzle,
  getProductionGeneratorCatalog,
  getPuzzleGeneratorReadinessCatalog,
  getProductionPreviews,
  getPublicProductionPuzzle,
  productionFamilyKinds,
  solveProductionPuzzle,
  validateProductionPuzzle,
  validateProductionPreview,
} from "../../src/server/puzzle-production-generators";

const secret = "all-production-generator-test-secret-00000000000000000000";

describe("Witness Puzzle Box 70 production generators", () => {
  it("classifies all 70 Blueprints without counting generic carriers as production", () => {
    const readiness = getPuzzleGeneratorReadinessCatalog();
    expect(readiness).toHaveLength(70);
    expect(readiness.map((entry) => entry.puzzleBlueprintId)).toEqual(Array.from({ length: 70 }, (_, index) => `PZB-${String(index + 1).padStart(3, "0")}`));
    expect(new Set(readiness.map((entry) => entry.primaryFamily))).toEqual(new Set(Object.keys(productionFamilyKinds)));
    for (const tier of ["TIER_1_INITIATE", "TIER_2_ADEPT", "TIER_3_EXPERT", "TIER_4_MASTER", "TIER_5_ORDEAL"]) {
      expect(readiness.filter((entry) => entry.difficultyTier === tier)).toHaveLength(14);
    }
    expect(readiness.filter((entry) => entry.productionStatus === "PRODUCTION").map((entry) => entry.puzzleBlueprintId).sort()).toEqual(["PZB-011", "PZB-012", "PZB-021", "PZB-037"]);
    expect(readiness.filter((entry) => entry.productionStatus === "PROTOTYPE_ONLY")).toHaveLength(66);
  });

  it("deterministically generates, solves, and rejects decoys for the four authored tutorials", () => {
    expect(getProductionGeneratorCatalog()).toHaveLength(4);
    for (const entry of getProductionGeneratorCatalog()) {
      const input = { generatorVersion: entry.generatorVersion, puzzleBlueprintId: entry.puzzleBlueprintId, seed: "coverage-seed-01", subjectKey: "PLAYER-COVERAGE" };
      const generated = generateProductionPuzzle(input, secret);
      expect(generateProductionPuzzle(input, secret)).toEqual(generated);
      expect(generateProductionPuzzle({ ...input, seed: "coverage-seed-02" }, secret).instanceChecksum).not.toBe(generated.instanceChecksum);
      expect(generateProductionPuzzle({ ...input, subjectKey: "PLAYER-COVERAGE-ALTERNATE" }, secret).instanceChecksum).not.toBe(generated.instanceChecksum);
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
      expect(entry.generatorVersion).toBe("1.1.0");
    }
  });

  it("preserves immutable 1.0.0 behavior while current production uses 1.1.0", () => {
    for (const entry of getProductionGeneratorCatalog()) {
      const historical = generateProductionPuzzle({ generatorVersion: "1.0.0", puzzleBlueprintId: entry.puzzleBlueprintId, seed: "historical-seed", subjectKey: "HISTORICAL" }, secret);
      const current = generateProductionPuzzle({ generatorVersion: "1.1.0", puzzleBlueprintId: entry.puzzleBlueprintId, seed: "historical-seed", subjectKey: "HISTORICAL" }, secret);
      expect(historical.generatorVersion).toBe("1.0.0");
      expect(current.generatorVersion).toBe("1.1.0");
      expect(current.instanceChecksum).not.toBe(historical.instanceChecksum);
    }
  });

  it("generates the rebuilt bitmap and musical glyph contracts", () => {
    const cancellation = generateProductionPuzzle({ generatorVersion: "1.1.0", puzzleBlueprintId: "PZB-011", seed: "shape-seed", subjectKey: "SHAPE" }, secret);
    expect(cancellation.canonicalSolution).toMatch(/^[A-H2-9]{6}$/);
    expect(cancellation.carrier.kind).toBe("ORDINAL_CANCELLATION_MATRIX");
    if (cancellation.carrier.kind !== "ORDINAL_CANCELLATION_MATRIX") throw new Error("wrong carrier");
    expect(cancellation.carrier.matrixA).toHaveLength(7);
    expect(cancellation.carrier.matrixA.every((row) => row.length === 31)).toBe(true);
    const zeroes = cancellation.carrier.matrixA.flatMap((row, rowIndex) => row.flatMap((value, columnIndex) => value + cancellation.carrier.matrixB[rowIndex]![columnIndex]! === 0 ? [`${rowIndex}:${columnIndex}`] : []));
    expect(zeroes.length).toBeGreaterThanOrEqual(48);
    expect(zeroes.length).toBeLessThanOrEqual(78);
    expect(solveProductionPuzzle(cancellation)).toEqual([cancellation.canonicalSolution]);

    const music = generateProductionPuzzle({ generatorVersion: "1.1.0", puzzleBlueprintId: "PZB-037", seed: "music-shape-seed", subjectKey: "SHAPE" }, secret);
    expect(music.canonicalSolution).toMatch(/^[A-F]{6}$/);
    expect(music.carrier.kind).toBe("MUSICAL_HEX_GRID");
    if (music.carrier.kind !== "MUSICAL_HEX_GRID") throw new Error("wrong carrier");
    expect(music.carrier.colorCells).toHaveLength(128);
    expect(music.carrier.colorCells.every((cell) => /^[A-F]{6}$/.test(cell))).toBe(true);
    expect(solveProductionPuzzle(music)).toEqual([music.canonicalSolution]);
  });

  it("rejects a generic Blueprint that has no authored production generator", () => {
    expect(() => generateProductionPuzzle({ generatorVersion: "1.0.0", puzzleBlueprintId: "PZB-001", seed: "coverage-seed-01", subjectKey: "PLAYER-COVERAGE" }, secret)).toThrow(/no authored production generator/i);
  });

  it("returns only answer-free client projections with complete accessibility and hints", () => {
    for (const entry of getProductionGeneratorCatalog()) {
      const generated = generateProductionPuzzle({ generatorVersion: entry.generatorVersion, puzzleBlueprintId: entry.puzzleBlueprintId, seed: "coverage-seed-01", subjectKey: "PLAYER-COVERAGE" }, secret);
      const projection = getPublicProductionPuzzle(generated);
      const serialized = JSON.stringify(projection);
      expect(serialized).not.toContain(secret);
      expect(serialized).not.toContain("coverage-seed-01");
      expect(serialized).not.toMatch(/"(?:answerFormat|canonicalSolution|carrier|concept|difficultyTier|expectedSolvePath|familyKind|generatorVersion|instanceChecksum|instanceId|liveRuntimeRecordsCreated|playerFacingModalities|proofDigest|puzzleBlueprintId|seed|subjectKey|timerStarted|title|validationToken)"\s*:/i);
      expect(projection.accessibilityModes).toEqual(entry.accessibilityModes);
      expect(projection.hints).toHaveLength(2);
      expect(projection.publicTitle).toBe(entry.publicTitle);
      expect(projection.publicSlug).toBe(entry.publicSlug);
      expect(projection).not.toHaveProperty("concept");
      expect(projection).not.toHaveProperty("expectedSolvePath");
      expect(projection).not.toHaveProperty("generatorVersion");
      expect(projection).not.toHaveProperty("instanceChecksum");
      expect(projection).not.toHaveProperty("timerStarted");
      expect(projection).not.toHaveProperty("liveRuntimeRecordsCreated");
    }
  });

  it("uses only the authored tutorial carriers in the production catalog", () => {
    const observed = new Set<string>();
    for (const entry of getProductionGeneratorCatalog()) {
      const generated = generateProductionPuzzle({ generatorVersion: entry.generatorVersion, puzzleBlueprintId: entry.puzzleBlueprintId, seed: "family-seed", subjectKey: "PLAYER-FAMILY" }, secret);
      observed.add(generated.familyKind);
    }
    expect(observed).toEqual(new Set(["NUMERIC_LEDGER", "VISUAL_SHAPE_LAYERS", "AUDIO_CAPTION_SEQUENCE"]));
  });

  it("serves only the four authored production previews and validates them server-side", () => {
    const previews = getProductionPreviews(secret);
    expect(previews).toHaveLength(4);
    expect(previews.map((preview) => preview.publicSlug).sort()).toEqual(["glass-vespers", "quiet-accord", "the-pall", "third-reading"]);
    expect(validateProductionPreview("PZB-011", "DECLARED-DECOY", secret)).toEqual({ correct: false, puzzleBlueprintId: "PZB-011", timerStarted: false });
    expect(() => validateProductionPreview("PZB-001", "anything", secret)).toThrow(/no authored production generator/i);
    expect(() => validateProductionPreview("PZB-999", "anything", secret)).toThrow("Unknown production Puzzle Blueprint: PZB-999");
  });
});
