import { z } from "zod";

import { PuzzleDifficultyTier, PuzzleFamily } from "../generated/prisma/enums";
import type { PrismaClient } from "../generated/prisma/client";
import { deterministicPuzzlePreviewKey } from "../domain/puzzle-blueprint";
import { getDatabase } from "./database";

const hintSchema = z.string().trim().min(1).max(10_000);

export const createPuzzleBlueprintSchema = z.object({
  difficultyTier: z.enum(PuzzleDifficultyTier),
  directionalHint: hintSchema,
  family: z.enum(PuzzleFamily),
  generatorVersion: z.number().int(),
  guidedHint: hintSchema,
  puzzleBlueprintId: z.string().trim().min(1).max(120),
}).strict();

export const appendPuzzleVersionSchema = z.object({
  directionalHint: hintSchema,
  generatorVersion: z.number().int(),
  guidedHint: hintSchema,
}).strict();

export const puzzlePreviewIdentitySchema = z.object({
  attempt: z.number().int().nonnegative(),
  campaignId: z.string().trim().min(1),
  generatorVersion: z.number().int(),
  playerId: z.string().trim().min(1),
  puzzleBlueprintId: z.string().trim().min(1),
  seed: z.string().min(1),
}).strict();

export class PuzzleAuthoringConflictError extends Error {}

const detailInclude = {
  versions: {
    include: { hints: { orderBy: { level: "asc" as const } } },
    orderBy: { generatorVersion: "desc" as const },
  },
};

export async function getPuzzleBlueprint(puzzleBlueprintId: string, database: PrismaClient = getDatabase()) {
  const blueprint = await database.puzzleBlueprint.findUnique({ include: detailInclude, where: { puzzleBlueprintId } });
  if (!blueprint) throw new PuzzleAuthoringConflictError(`Puzzle Blueprint ${puzzleBlueprintId} does not exist.`);
  return blueprint;
}

function versionData(puzzleBlueprintId: string, input: { directionalHint: string; generatorVersion: number; guidedHint: string }) {
  return {
    generatorVersion: input.generatorVersion,
    hints: {
      create: [
        { kind: "DIRECTIONAL" as const, level: 1, template: input.directionalHint },
        { kind: "GUIDED" as const, level: 2, template: input.guidedHint },
      ],
    },
    puzzleBlueprintId,
  };
}

export async function createPuzzleBlueprint(
  input: z.infer<typeof createPuzzleBlueprintSchema>,
  database: PrismaClient = getDatabase(),
) {
  const parsed = createPuzzleBlueprintSchema.parse(input);
  return database.$transaction(async (transaction) => {
    const existing = await transaction.puzzleBlueprint.findUnique({ where: { puzzleBlueprintId: parsed.puzzleBlueprintId } });
    if (existing) throw new PuzzleAuthoringConflictError(`Puzzle Blueprint ${parsed.puzzleBlueprintId} already exists.`);
    await transaction.puzzleBlueprint.create({
      data: { difficultyTier: parsed.difficultyTier, family: parsed.family, puzzleBlueprintId: parsed.puzzleBlueprintId },
    });
    await transaction.puzzleBlueprintVersion.create({ data: versionData(parsed.puzzleBlueprintId, parsed) });
    return getPuzzleBlueprint(parsed.puzzleBlueprintId, transaction as PrismaClient);
  }, { isolationLevel: "Serializable" });
}

export async function appendPuzzleVersion(
  puzzleBlueprintId: string,
  input: z.infer<typeof appendPuzzleVersionSchema>,
  database: PrismaClient = getDatabase(),
) {
  const parsed = appendPuzzleVersionSchema.parse(input);
  return database.$transaction(async (transaction) => {
    const blueprint = await transaction.puzzleBlueprint.findUnique({ where: { puzzleBlueprintId } });
    if (!blueprint) throw new PuzzleAuthoringConflictError(`Puzzle Blueprint ${puzzleBlueprintId} does not exist.`);
    const existing = await transaction.puzzleBlueprintVersion.findUnique({
      where: { puzzleBlueprintId_generatorVersion: { generatorVersion: parsed.generatorVersion, puzzleBlueprintId } },
    });
    if (existing) throw new PuzzleAuthoringConflictError(`Generator version ${parsed.generatorVersion} already exists and is immutable.`);
    await transaction.puzzleBlueprintVersion.create({ data: versionData(puzzleBlueprintId, parsed) });
    return getPuzzleBlueprint(puzzleBlueprintId, transaction as PrismaClient);
  }, { isolationLevel: "Serializable" });
}

export async function validatePuzzlePreviewIdentity(
  input: z.infer<typeof puzzlePreviewIdentitySchema>,
  database: PrismaClient = getDatabase(),
) {
  const parsed = puzzlePreviewIdentitySchema.parse(input);
  const version = await database.puzzleBlueprintVersion.findUnique({
    where: { puzzleBlueprintId_generatorVersion: { generatorVersion: parsed.generatorVersion, puzzleBlueprintId: parsed.puzzleBlueprintId } },
  });
  if (!version) throw new PuzzleAuthoringConflictError(`Puzzle Blueprint version ${parsed.puzzleBlueprintId}@${parsed.generatorVersion} does not exist.`);
  return { key: deterministicPuzzlePreviewKey(parsed), timerStarted: false as const };
}
