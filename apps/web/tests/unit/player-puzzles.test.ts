import { describe, expect, it, vi } from "vitest";

import { acceptPlayerPuzzleChallenge, getPlayerPuzzleChallenges } from "../../src/server/player-puzzles";

function legacyWitnessAssignmentDatabase() {
  return {
    gameSession: { findFirst: vi.fn().mockResolvedValue({ settlementWorld: { worldKey: "CONCORD" } }) },
    campaign: { findUnique: vi.fn().mockResolvedValue({ placements: [{ objectId: "WITNESS-1" }] }) },
    witness: { findMany: vi.fn().mockResolvedValue([{ antagonist1: { puzzleBlueprintId: "PUZZLE-1", witnessName: "The Resonant Gate" }, antagonist2: null, witnessId: "WITNESS-1" }]) },
  };
}

describe("player Puzzle challenge boundary", () => {
  it("does not reinterpret legacy Witness rows as Puzzle assignments", async () => {
    const database = {
      ...legacyWitnessAssignmentDatabase(),
      puzzleBlueprint: { findMany: vi.fn() },
    } as never;
    const result = await getPlayerPuzzleChallenges("USER-1", new Date("2026-08-10T00:00:00.000Z"), database);
    expect(result.puzzles).toEqual([]);
    expect(database.puzzleBlueprint.findMany).not.toHaveBeenCalled();
  });

  it("fails closed until a canonical Puzzle assignment owner is authorized", async () => {
    const database = legacyWitnessAssignmentDatabase() as never;
    await expect(acceptPlayerPuzzleChallenge({ generatorVersion: "2.0.0", puzzleBlueprintId: "PUZZLE-1", userId: "USER-1" }, new Date(), database)).rejects.toThrow(/not assigned/);
  });

  it("rejects acceptance for a Puzzle outside the player's current campaign", async () => {
    const database = legacyWitnessAssignmentDatabase() as never;
    await expect(acceptPlayerPuzzleChallenge({ generatorVersion: "1.0.0", puzzleBlueprintId: "PUZZLE-OTHER", userId: "USER-1" }, new Date(), database)).rejects.toThrow(/not assigned/);
  });
});
