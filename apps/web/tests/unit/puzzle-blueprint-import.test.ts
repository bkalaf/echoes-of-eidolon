import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { parsePuzzleBlueprintIntakeRow } from "../../src/domain/puzzle-blueprint";
import { parsePuzzleBlueprintPackageCsv } from "../../src/domain/puzzle-blueprint-package";
import {
  importPuzzleBlueprintPackage,
  parsePuzzleBlueprintImportArguments,
  PuzzleBlueprintImportConflictError,
} from "../../src/server/puzzle-blueprint-import";
import { buildProductionPuzzleVersionAddition } from "../../src/server/puzzle-production-version-persistence";

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
  it("rejects any package byte drift before opening a database transaction", async () => {
    const { database } = importDatabase();
    await expect(importPuzzleBlueprintPackage(source.replace("Missing Commas Almanac", "Changed Commas Almanac"), {}, database)).rejects.toThrow(/checksum mismatch/i);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it("defaults to a read-only plan and performs zero writes", async () => {
    const { database, transaction } = importDatabase();
    const result = await importPuzzleBlueprintPackage(source, {}, database);
    expect(result).toMatchObject({ applied: false, mode: "verify", packageBlueprints: 70, missingRoots: 70, missingVersions: 70, supplementalMissingVersions: 4 });
    expect(transaction.puzzleBlueprint.create).not.toHaveBeenCalled();
    expect(transaction.puzzleBlueprintVersion.create).not.toHaveBeenCalled();
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("creates all 70 roots and immutable versions only in explicit apply mode with a named target", async () => {
    const { database, transaction } = importDatabase();
    const result = await importPuzzleBlueprintPackage(source, { mode: "apply", targetEnvironment: "disposable-test" }, database);
    expect(result).toMatchObject({ applied: true, mode: "apply", targetEnvironment: "disposable-test", packageBlueprints: 70, missingRoots: 70, missingVersions: 70, supplementalMissingVersions: 4 });
    expect(transaction.puzzleBlueprint.create).toHaveBeenCalledTimes(70);
    expect(transaction.puzzleBlueprint.create.mock.calls.filter(([call]) => call.data.versions.create.length === 2)).toHaveLength(4);
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("rejects apply mode without an explicit target before database access", async () => {
    const { database } = importDatabase();
    await expect(importPuzzleBlueprintPackage(source, { mode: "apply" }, database)).rejects.toThrow(/target environment/i);
    expect(database.$transaction).not.toHaveBeenCalled();
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

  it("supports an explicit read-only verification pass", async () => {
    const { database, transaction } = importDatabase();
    const result = await importPuzzleBlueprintPackage(source, { mode: "verify" }, database);
    expect(result).toMatchObject({ applied: false, mode: "verify", missingRoots: 70, missingVersions: 70 });
    expect(transaction.puzzleBlueprint.create).not.toHaveBeenCalled();
  });

  it("is idempotent when all 70 immutable roots, versions, and hints already match", async () => {
    const existing = parsePuzzleBlueprintPackageCsv(source).map((row) => {
      const entry = parsePuzzleBlueprintIntakeRow(row);
      return {
        ...entry.root,
        versions: [{
          design: entry.version.design,
          generatorVersion: entry.version.generatorVersion,
          hints: entry.hints.map(({ kind, level, template }) => ({ kind, level, template })),
        }, ...(() => {
          const supplemental = buildProductionPuzzleVersionAddition(entry.root.puzzleBlueprintId, entry.version.design);
          return supplemental ? [{ design: supplemental.design, generatorVersion: supplemental.generatorVersion, hints: supplemental.hints }] : [];
        })()],
      };
    });
    const { database, transaction } = importDatabase(existing);

    const result = await importPuzzleBlueprintPackage(source, { mode: "apply", targetEnvironment: "disposable-test" }, database);

    expect(result).toMatchObject({ applied: true, mode: "apply", missingRoots: 0, missingVersions: 0, unchangedVersions: 70, supplementalMissingVersions: 0, supplementalUnchangedVersions: 4 });
    expect(transaction.puzzleBlueprint.create).not.toHaveBeenCalled();
    expect(transaction.puzzleBlueprintVersion.create).not.toHaveBeenCalled();
  });

  it("appends exactly four production 1.1.0 versions to an already imported package", async () => {
    const existing = parsePuzzleBlueprintPackageCsv(source).map((row) => {
      const entry = parsePuzzleBlueprintIntakeRow(row);
      return {
        ...entry.root,
        versions: [{
          design: entry.version.design,
          generatorVersion: entry.version.generatorVersion,
          hints: entry.hints.map(({ kind, level, template }) => ({ kind, level, template })),
        }],
      };
    });
    const { database, transaction } = importDatabase(existing);

    const result = await importPuzzleBlueprintPackage(source, { mode: "apply", targetEnvironment: "upgrade-test" }, database);

    expect(result).toMatchObject({ missingRoots: 0, missingVersions: 0, supplementalMissingVersions: 4, supplementalUnchangedVersions: 0, unchangedVersions: 70 });
    expect(transaction.puzzleBlueprintVersion.create).toHaveBeenCalledTimes(4);
    expect(transaction.puzzleBlueprintVersion.create.mock.calls.map(([call]) => `${call.data.puzzleBlueprintId}@${call.data.generatorVersion}`).sort()).toEqual([
      "PZB-011@1.1.0", "PZB-012@1.1.0", "PZB-021@1.1.0", "PZB-037@1.1.0",
    ]);
  });

  it("parses CLI mode fail-closed and requires an explicit apply target", () => {
    expect(parsePuzzleBlueprintImportArguments([])).toEqual({ mode: "verify" });
    expect(parsePuzzleBlueprintImportArguments(["--verify-only"])).toEqual({ mode: "verify" });
    expect(parsePuzzleBlueprintImportArguments(["--apply", "--target=staging"])).toEqual({ mode: "apply", targetEnvironment: "staging" });
    expect(() => parsePuzzleBlueprintImportArguments(["--apply"])).toThrow(/target environment/i);
    expect(() => parsePuzzleBlueprintImportArguments(["--apply", "--verify-only", "--target=staging"])).toThrow(/conflicting/i);
    expect(() => parsePuzzleBlueprintImportArguments(["--unknown"])).toThrow(/unknown/i);
  });
});
