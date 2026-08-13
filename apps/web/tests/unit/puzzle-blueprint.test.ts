import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { challengeWindowFromAcceptance, compareGeneratorVersions, deterministicPuzzlePreviewKey, parsePuzzleBlueprintIntakeRow, puzzleBlueprintIntakeFieldMap, puzzleChallengeDurationSeconds, validatePuzzleBlueprint, validatePuzzleBlueprintIntakePackage } from "../../src/domain/puzzle-blueprint";

describe("Puzzle Blueprint contracts", () => {
  it("accepts semantic generator versions and validates one blueprint independently of bank size", () => {
    expect(validatePuzzleBlueprint({ puzzleBlueprintId: "PZB-001", title: "A puzzle", primaryFamily: "LOGIC_CONSTRAINT", difficultyTier: "TIER_1_INITIATE", generatorVersion: "1.0.0", hints: [{ level: 1, kind: "DIRECTIONAL", template: "Look east.", containsAnswer: false }, { level: 2, kind: "GUIDED", template: "Compare the symbols.", containsAnswer: false }] }).generatorVersion).toBe("1.0.0");
    expect(compareGeneratorVersions("1.10.0", "1.2.0")).toBeGreaterThan(0);
  });

  it("keeps exact 70-row distribution checks in the Action-B intake contract", () => {
    expect(() => validatePuzzleBlueprintIntakePackage([])).toThrow(/exactly 70/);
  });

  it("maps the approved source shape and keeps proposal component handles provenance-only", () => {
    const artifact = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../../docs/audits/puzzle-blueprint-intake-field-map.json"), "utf8")) as { fields: Record<string, unknown>; importsRows: boolean };
    expect(Object.keys(artifact.fields).sort()).toEqual(Object.keys(puzzleBlueprintIntakeFieldMap).sort());
    expect(artifact.importsRows).toBe(false);
    const parsed = parsePuzzleBlueprintIntakeRow({ puzzleBlueprintId: "PZB-001", title: "A puzzle", concept: "Concept", primaryFamily: "LOGIC_CONSTRAINT", secondaryFamilies: "CROSS_MODAL", difficultyTier: "TIER_1_INITIATE", intendedProgressionRange: "1-3", playerFacingModality: "TEXT|VISUAL", accessibilityModalities: "TEXT|SCREEN_READER", reusableComponentRequirementIds: "PUZCMP-HINT-PANEL|PUZCMP-TIMER-BANNER", collaborationProfile: '{"mode":"solo"}', requiredTools: "PENCIL|PAPER", outsideResearchExpectation: "NONE", generatorVersion: "1.0.0", answerFormat: "FREE_TEXT", serverValidationMethod: "EXACT_MATCH", uniquenessProofMethod: "SEEDED", estimatedSolveTime: "20", hintLevel1: "Look east.", hintLevel2: "Compare symbols.", implementationComplexity: "MEDIUM", mobileFeasibility: "true", qualityScore: "90", recommendationStatus: "APPROVED", prototypeRequired: "false", prototypeDelivered: "false", tutorialConsideration: "true", highComplexityShowpiece: "false" });
    expect(parsed.version.generatorVersion).toBe("1.0.0");
    expect(parsed.version.design).not.toHaveProperty("reusableComponentRequirementIds");
    expect(parsed.provenanceOnly.reusableComponentRequirementIds).toEqual(["PUZCMP-HINT-PANEL", "PUZCMP-TIMER-BANNER"]);
    expect(parsed.hints).toHaveLength(2);
  });

  it("starts the exact immutable timer only from challenge acceptance", () => {
    const acceptedAt = new Date("2026-08-10T00:00:00.000Z");
    const window = challengeWindowFromAcceptance(acceptedAt);
    expect(window.durationSeconds).toBe(2_160_000);
    expect(puzzleChallengeDurationSeconds).toBe(2_160_000);
    expect(window.endsAt.getTime() - window.acceptedAt.getTime()).toBe(2_160_000_000);
    expect(Object.isFrozen(window)).toBe(true);
  });

  it("derives preview identity from blueprint, campaign, player, attempt, and seed without starting a timer", () => {
    const input = { puzzleBlueprintId: "PZ", generatorVersion: "1.0.0", campaignId: "CAM", playerId: "PLAYER", attempt: 2, seed: "SEED" };
    expect(deterministicPuzzlePreviewKey(input)).toBe(deterministicPuzzlePreviewKey({ ...input }));
    expect(deterministicPuzzlePreviewKey({ ...input, seed: "OTHER" })).not.toBe(deterministicPuzzlePreviewKey(input));
    expect(deterministicPuzzlePreviewKey(input)).not.toMatch(/acceptedAt|endsAt|timer/);
  });
});
