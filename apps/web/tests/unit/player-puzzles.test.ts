import { describe, expect, it, vi } from "vitest";

import { acceptPlayerPuzzleChallenge, getPlayerPuzzleChallenges } from "../../src/server/player-puzzles";

function assignmentDatabase() {
  return {
    gameSession: { findFirst: vi.fn().mockResolvedValue({ settlementWorld: { worldKey: "CONCORD" } }) },
    campaign: { findUnique: vi.fn().mockResolvedValue({ placements: [{ objectId: "WITNESS-1" }] }) },
    witness: { findMany: vi.fn().mockResolvedValue([{ antagonist1: { puzzleBlueprintId: "PUZZLE-1", witnessName: "The Resonant Gate" }, antagonist2: null, witnessId: "WITNESS-1" }]) },
  };
}

describe("player Puzzle challenge boundary", () => {
  it("projects only current-World campaign assignments and withholds hints before acceptance", async () => {
    const database = {
      ...assignmentDatabase(),
      puzzleBlueprint: { findMany: vi.fn().mockResolvedValue([{ difficultyTier: "TIER_1_INITIATE", family: "MUSIC", puzzleBlueprintId: "PUZZLE-1", versions: [{ acceptances: [], generatorVersion: 2, hints: [{ kind: "DIRECTIONAL", level: 1, template: "Listen east." }] }] }]) },
    } as never;
    const result = await getPlayerPuzzleChallenges("USER-1", new Date("2026-08-10T00:00:00.000Z"), database);
    expect(result.puzzles).toEqual([expect.objectContaining({ acceptance: null, hints: [], name: "The Resonant Gate", puzzleBlueprintId: "PUZZLE-1" })]);
  });

  it("creates one idempotent acceptance for an assigned immutable version", async () => {
    const acceptedAt = new Date("2026-08-10T00:00:00.000Z");
    const upsert = vi.fn().mockResolvedValue({ acceptedAt, generatorVersion: 2, puzzleBlueprintId: "PUZZLE-1", puzzleChallengeAcceptedId: "ACCEPT-1" });
    const database = {
      ...assignmentDatabase(),
      puzzleBlueprintVersion: { findUnique: vi.fn().mockResolvedValue({ generatorVersion: 2, puzzleBlueprintId: "PUZZLE-1" }) },
      $transaction: vi.fn(async (callback) => callback({ puzzleChallengeAccepted: { upsert } })),
    } as never;
    const result = await acceptPlayerPuzzleChallenge({ generatorVersion: 2, puzzleBlueprintId: "PUZZLE-1", userId: "USER-1" }, acceptedAt, database);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {}, where: { userId_puzzleBlueprintId_generatorVersion: { generatorVersion: 2, puzzleBlueprintId: "PUZZLE-1", userId: "USER-1" } } }));
    expect(result.remainingSeconds).toBe(2_160_000);
  });

  it("rejects acceptance for a Puzzle outside the player's current campaign", async () => {
    const database = assignmentDatabase() as never;
    await expect(acceptPlayerPuzzleChallenge({ generatorVersion: 1, puzzleBlueprintId: "PUZZLE-OTHER", userId: "USER-1" }, new Date(), database)).rejects.toThrow(/not assigned/);
  });
});
