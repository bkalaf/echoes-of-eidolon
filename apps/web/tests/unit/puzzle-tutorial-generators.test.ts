import { describe, expect, it } from "vitest";

import {
  generateTutorialPuzzle,
  getTutorialProductionPreviews,
  getPublicTutorialPuzzle,
  resolveTutorialRoute,
  solveTutorialPuzzle,
  tutorialPuzzleBlueprintIds,
  validateTutorialProductionPreview,
  validateTutorialPuzzle,
} from "../../src/server/puzzle-tutorial-generators";

const secret = "tutorial-generator-test-secret-000000000000000000000000";
const input = (puzzleBlueprintId: (typeof tutorialPuzzleBlueprintIds)[number], seed = "SEED-001") => ({
  generatorVersion: "1.0.0" as const,
  puzzleBlueprintId,
  seed,
  subjectKey: "PLAYER-001",
});

describe("Witness Puzzle Box tutorial production generators", () => {
  it("generates the exact tutorial four deterministically with immutable versions", () => {
    expect(tutorialPuzzleBlueprintIds).toEqual(["PZB-011", "PZB-012", "PZB-037", "PZB-021"]);
    for (const puzzleBlueprintId of tutorialPuzzleBlueprintIds) {
      const first = generateTutorialPuzzle(input(puzzleBlueprintId), secret);
      const replay = generateTutorialPuzzle(input(puzzleBlueprintId), secret);
      const divergent = generateTutorialPuzzle(input(puzzleBlueprintId, "SEED-002"), secret);
      expect(replay).toEqual(first);
      expect(divergent.instanceChecksum).not.toBe(first.instanceChecksum);
      expect(first.generatorVersion).toBe("1.0.0");
      expect(first.instanceChecksum).toMatch(/^[0-9a-f]{64}$/);
      expect(first.proofDigest).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(() => generateTutorialPuzzle({ ...input("PZB-011"), generatorVersion: "1.0.1" as "1.0.0" }, secret)).toThrow(/immutable generator version/i);
  });

  it("proves one solution per instance and rejects alternate and decoy submissions", () => {
    for (const puzzleBlueprintId of tutorialPuzzleBlueprintIds) {
      const generated = generateTutorialPuzzle(input(puzzleBlueprintId), secret);
      const solutions = solveTutorialPuzzle(generated);
      expect(solutions).toEqual([generated.canonicalSolution]);
      expect(validateTutorialPuzzle(generated, generated.canonicalSolution, secret)).toBe(true);
      expect(validateTutorialPuzzle(generated, `${generated.canonicalSolution}-DECOY`, secret)).toBe(false);
      expect(generated.uniqueSolution).toBe(true);
      expect(generated.alternateSolutionsRejected).toBe(true);
    }
  });

  it("projects answer-free carriers with equivalent declared accessibility modes", () => {
    for (const puzzleBlueprintId of tutorialPuzzleBlueprintIds) {
      const generated = generateTutorialPuzzle(input(puzzleBlueprintId), secret);
      const projection = getPublicTutorialPuzzle(generated);
      const serialized = JSON.stringify(projection);
      expect(serialized).not.toContain(secret);
      expect(serialized).not.toContain("SEED-001");
      expect(serialized).not.toMatch(/"(?:canonicalSolution|proofDigest|seed|subjectKey|validationToken)"\s*:/i);
      expect(projection.accessibilityModes.length).toBeGreaterThan(0);
      expect(projection.timerStarted).toBe(false);
      expect(projection.liveRuntimeRecordsCreated).toBe(0);
    }
  });

  it("uses family-specific exhaustive proof paths for all four authored concepts", () => {
    const cancellation = generateTutorialPuzzle(input("PZB-011"), secret);
    expect(cancellation.carrier.kind).toBe("ORDINAL_CANCELLATION_MATRIX");
    expect(solveTutorialPuzzle(cancellation)).toHaveLength(1);

    const setAmbigram = generateTutorialPuzzle(input("PZB-012"), secret);
    expect(setAmbigram.carrier.kind).toBe("SET_AMBIGRAM");
    expect(solveTutorialPuzzle(setAmbigram)).toHaveLength(1);

    const music = generateTutorialPuzzle(input("PZB-037"), secret);
    expect(music.carrier.kind).toBe("MUSICAL_HEX_GRID");
    expect(solveTutorialPuzzle(music)).toHaveLength(1);

    const qr = generateTutorialPuzzle(input("PZB-021"), secret);
    expect(qr.carrier.kind).toBe("TYPOGRAPHIC_QR_THRESHOLD");
    const route = resolveTutorialRoute(qr, qr.routeToken!, secret);
    expect(route.symbolCards).toHaveLength(10);
    expect(route.symbolCards.map((card) => card.symbol).join("")).not.toBe(qr.canonicalSolution);
    expect([...route.symbolCards].sort((left, right) => left.ordinal - right.ordinal).map((card) => card.symbol).join("")).toBe(qr.canonicalSolution);
    expect(() => resolveTutorialRoute(qr, `${qr.routeToken}x`, secret)).toThrow(/route token/i);
  });

  it("provides deterministic admin previews and validates them without accepting browser seed material", () => {
    const previews = getTutorialProductionPreviews(secret);
    expect(previews.map((preview) => preview.puzzleBlueprintId)).toEqual(tutorialPuzzleBlueprintIds);
    expect(JSON.stringify(previews)).not.toMatch(/"(?:seed|subjectKey|canonicalSolution|proofDigest)"\s*:/i);
    const generated = generateTutorialPuzzle({ generatorVersion: "1.0.0", puzzleBlueprintId: "PZB-011", seed: "admin-preview-v1", subjectKey: "ADMIN-PREVIEW" }, secret);
    expect(validateTutorialProductionPreview("PZB-011", generated.canonicalSolution, secret).correct).toBe(true);
    expect(validateTutorialProductionPreview("PZB-011", "DECOY", secret).correct).toBe(false);
  });
});
