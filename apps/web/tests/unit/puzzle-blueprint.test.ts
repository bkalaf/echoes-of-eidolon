import { describe, expect, it } from "vitest";

import { challengeWindowFromAcceptance, deterministicPuzzlePreviewKey, puzzleChallengeDurationSeconds, puzzleDifficultyTiers, puzzleFamilies, validateInitialPuzzleBank, type PuzzleBlueprintSeed } from "../../src/domain/puzzle-blueprint";

function validBank(): PuzzleBlueprintSeed[] {
  return Array.from({ length: 70 }, (_, index) => ({
    puzzleBlueprintId: `PUZZLE-${String(index + 1).padStart(3, "0")}`,
    family: puzzleFamilies[index % puzzleFamilies.length]!,
    difficultyTier: puzzleDifficultyTiers[Math.floor(index / 14)]!,
    generatorVersion: 1,
    hints: [
      { level: 1, kind: "DIRECTIONAL", template: `Direction ${index}`, containsAnswer: false },
      { level: 2, kind: "GUIDED", template: `Guide ${index}`, containsAnswer: false },
    ],
  }));
}

describe("Puzzle Blueprint contracts", () => {
  it("accepts exactly 70 roots with 14 per tier and two ordered answer-free hints", () => {
    expect(() => validateInitialPuzzleBank(validBank())).not.toThrow();
    expect(() => validateInitialPuzzleBank(validBank().slice(0, 69))).toThrow(/exactly 70/);
    const wrongTier = validBank();
    wrongTier[0] = { ...wrongTier[0]!, difficultyTier: "TIER_2_ADEPT" };
    expect(() => validateInitialPuzzleBank(wrongTier)).toThrow(/TIER_1_INITIATE/);

    const zeroVersion = validBank();
    zeroVersion[0] = { ...zeroVersion[0]!, generatorVersion: 0 };
    expect(() => validateInitialPuzzleBank(zeroVersion)).not.toThrow();
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
    const input = { puzzleBlueprintId: "PZ", generatorVersion: 0, campaignId: "CAM", playerId: "PLAYER", attempt: 2, seed: "SEED" };
    expect(deterministicPuzzlePreviewKey(input)).toBe(deterministicPuzzlePreviewKey({ ...input }));
    expect(deterministicPuzzlePreviewKey({ ...input, seed: "OTHER" })).not.toBe(deterministicPuzzlePreviewKey(input));
    expect(deterministicPuzzlePreviewKey(input)).not.toMatch(/acceptedAt|endsAt|timer/);
  });
});
