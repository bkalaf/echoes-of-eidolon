import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { importPuzzleBlueprintPackage, PuzzleBlueprintImportConflictError } from "../../src/server/puzzle-blueprint-import";

const source = readFileSync(resolve(import.meta.dirname, "../../data/puzzles/puzzle-blueprint-bank-70.csv"), "utf8");

function importDatabase(existing: unknown[] = []) {
  const transaction = {
    puzzleBlueprint: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue(existing),
    },
    puzzleBlueprintVersion: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    $transaction: vi.fn(async (work: (client: typeof transaction) => Promise<unknown>) => work(transaction)),
  } as unknown as PrismaClient;
  return { database, transaction };
}

describe("Puzzle Blueprint package import", () => {
  it("plans and creates all 70 roots and immutable versions in one serializable transaction", async () => {
    const { database, transaction } = importDatabase();
    const result = await importPuzzleBlueprintPackage(source, {}, database);
    expect(result).toMatchObject({ applied: true, packageBlueprints: 70, missingRoots: 70, missingVersions: 70 });
    expect(transaction.puzzleBlueprint.create).toHaveBeenCalledTimes(70);
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("fails closed on an existing root conflict before overwriting anything", async () => {
    const { database, transaction } = importDatabase([{
      puzzleBlueprintId: "PZB-001",
      title: "Conflicting title",
      primaryFamily: "TEXT_LANGUAGE_LITERARY",
      difficultyTier: "TIER_1_INITIATE",
      versions: [],
    }]);
    await expect(importPuzzleBlueprintPackage(source, {}, database)).rejects.toThrow(PuzzleBlueprintImportConflictError);
    expect(transaction.puzzleBlueprintVersion.create).not.toHaveBeenCalled();
  });

  it("supports a read-only verification pass", async () => {
    const { database, transaction } = importDatabase();
    const result = await importPuzzleBlueprintPackage(source, { verifyOnly: true }, database);
    expect(result).toMatchObject({ applied: false, missingRoots: 70, missingVersions: 70 });
    expect(transaction.puzzleBlueprint.create).not.toHaveBeenCalled();
  });
});

