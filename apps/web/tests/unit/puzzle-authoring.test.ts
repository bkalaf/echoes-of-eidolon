import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { appendPuzzleVersion, createPuzzleBlueprint, PuzzleAuthoringConflictError, validatePuzzlePreviewIdentity } from "../../src/server/puzzle-authoring";

function authoringDatabase(options: { existingRoot?: boolean; existingVersion?: boolean } = {}) {
  const client = {
    puzzleBlueprint: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn()
        .mockResolvedValueOnce(options.existingRoot ? { puzzleBlueprintId: "PZ-1" } : null)
        .mockResolvedValue({ difficultyTier: "TIER_1_INITIATE", family: "LOGIC_CONSTRAINT", puzzleBlueprintId: "PZ-1", versions: [] }),
    },
    puzzleBlueprintVersion: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(options.existingVersion ? { generatorVersion: 2 } : null),
    },
  };
  const database = { $transaction: vi.fn(async (work: (transaction: typeof client) => Promise<unknown>) => work(client)) } as unknown as PrismaClient;
  return { client, database };
}

describe("Puzzle Blueprint authoring", () => {
  const manualDesign = { schemaVersion: "manual-authoring-v1" as const };

  it("creates one stable root and its two ordered hints in one serializable transaction", async () => {
    const { client, database } = authoringDatabase();
    await createPuzzleBlueprint({
      difficultyTier: "TIER_1_INITIATE",
      directionalHint: "Look at the left edge.",
      primaryFamily: "LOGIC_CONSTRAINT",
      title: "Puzzle One",
      generatorVersion: "1.0.0",
      guidedHint: "Compare the first and third rows.",
      puzzleBlueprintId: "PZ-1",
    }, database);
    expect(client.puzzleBlueprint.create).toHaveBeenCalledWith({ data: { difficultyTier: "TIER_1_INITIATE", primaryFamily: "LOGIC_CONSTRAINT", title: "Puzzle One", puzzleBlueprintId: "PZ-1" } });
    expect(client.puzzleBlueprintVersion.create).toHaveBeenCalledWith({ data: {
      generatorVersion: "1.0.0",
      design: manualDesign,
      hints: { create: [
        { kind: "DIRECTIONAL", level: 1, template: "Look at the left edge." },
        { kind: "GUIDED", level: 2, template: "Compare the first and third rows." },
      ] },
      puzzleBlueprintId: "PZ-1",
    } });
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("rejects replacement of an existing immutable generator version", async () => {
    const { client, database } = authoringDatabase({ existingRoot: true, existingVersion: true });
    await expect(appendPuzzleVersion("PZ-1", { directionalHint: "Direction", generatorVersion: "2.0.0", design: manualDesign, guidedHint: "Guide" }, database)).rejects.toThrow(PuzzleAuthoringConflictError);
    expect(client.puzzleBlueprintVersion.create).not.toHaveBeenCalled();
  });

  it("requires both exact nonempty hint levels before opening a transaction", async () => {
    const { database } = authoringDatabase();
    await expect(createPuzzleBlueprint({
      difficultyTier: "TIER_1_INITIATE",
      directionalHint: "",
      primaryFamily: "LOGIC_CONSTRAINT",
      title: "Puzzle One",
      generatorVersion: "1.0.0",
      guidedHint: "Guide",
      puzzleBlueprintId: "PZ-1",
    }, database)).rejects.toThrow();
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it("validates preview identity against a persisted version without starting a timer", async () => {
    const database = { puzzleBlueprintVersion: { findUnique: vi.fn().mockResolvedValue({ generatorVersion: "4.0.0" }) } } as unknown as PrismaClient;
    const result = await validatePuzzlePreviewIdentity({ attempt: 0, campaignId: "CAM-1", generatorVersion: "4.0.0", playerId: "PLAYER-1", puzzleBlueprintId: "PZ-1", seed: "seed" }, database);
    expect(result.timerStarted).toBe(false);
    expect(result.key).toBe(JSON.stringify(["PZ-1", "4.0.0", "CAM-1", "PLAYER-1", 0, "seed"]));
  });
});
