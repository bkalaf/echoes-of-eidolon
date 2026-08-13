import { z } from "zod";

import { PuzzleDifficultyTier, PuzzleFamily } from "../generated/prisma/enums";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { assertGeneratorVersion, compareGeneratorVersions, deterministicPuzzlePreviewKey, puzzleBlueprintDesignV1Schema } from "../domain/puzzle-blueprint";
import { getDatabase } from "./database";

const hintSchema = z.string().trim().min(1).max(10_000);
const puzzleVersionDesignSchema = z.union([
  puzzleBlueprintDesignV1Schema,
  z.object({ schemaVersion: z.literal("manual-authoring-v1") }).strict(),
]);

export const createPuzzleBlueprintSchema = z.object({
  difficultyTier: z.enum(PuzzleDifficultyTier),
  directionalHint: hintSchema,
  primaryFamily: z.enum(PuzzleFamily),
  title: z.string().trim().min(1).max(200),
  generatorVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  guidedHint: hintSchema,
  puzzleBlueprintId: z.string().trim().min(1).max(120),
}).strict();

export const appendPuzzleVersionSchema = z.object({
  directionalHint: hintSchema,
  generatorVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  design: puzzleVersionDesignSchema,
  guidedHint: hintSchema,
}).strict();

export const puzzlePreviewIdentitySchema = z.object({
  attempt: z.number().int().nonnegative(),
  campaignId: z.string().trim().min(1),
  generatorVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  playerId: z.string().trim().min(1),
  puzzleBlueprintId: z.string().trim().min(1),
  seed: z.string().min(1),
}).strict();

export class PuzzleAuthoringConflictError extends Error {}

const detailInclude = {
  versions: {
    include: { hints: { orderBy: { level: "asc" as const } } },
    orderBy: { createdAt: "desc" as const },
  },
};

export async function getPuzzleBlueprint(puzzleBlueprintId: string, database: PrismaClient = getDatabase()) {
  const blueprint = await database.puzzleBlueprint.findUnique({ include: detailInclude, where: { puzzleBlueprintId } });
  if (!blueprint) throw new PuzzleAuthoringConflictError(`Puzzle Blueprint ${puzzleBlueprintId} does not exist.`);
  return blueprint;
}

function versionData(puzzleBlueprintId: string, input: { directionalHint: string; generatorVersion: string; guidedHint: string; design?: z.infer<typeof puzzleVersionDesignSchema> }) {
  return {
    generatorVersion: input.generatorVersion,
    design: (input.design ?? { schemaVersion: "manual-authoring-v1" }) as Prisma.InputJsonValue,
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
      data: { difficultyTier: parsed.difficultyTier, primaryFamily: parsed.primaryFamily, title: parsed.title, puzzleBlueprintId: parsed.puzzleBlueprintId },
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
    const versions = await transaction.puzzleBlueprintVersion.findMany({ where: { puzzleBlueprintId }, select: { generatorVersion: true } });
    if (versions.some((version) => compareGeneratorVersions(version.generatorVersion, parsed.generatorVersion) >= 0)) throw new PuzzleAuthoringConflictError("Generator version must be greater than all existing semantic versions.");
    await transaction.puzzleBlueprintVersion.create({ data: versionData(puzzleBlueprintId, parsed) });
    return getPuzzleBlueprint(puzzleBlueprintId, transaction as PrismaClient);
  }, { isolationLevel: "Serializable" });
}

export async function validatePuzzlePreviewIdentity(
  input: z.infer<typeof puzzlePreviewIdentitySchema>,
  database: PrismaClient = getDatabase(),
) {
  const parsed = puzzlePreviewIdentitySchema.parse(input);
  assertGeneratorVersion(parsed.generatorVersion);
  const version = await database.puzzleBlueprintVersion.findUnique({
    where: { puzzleBlueprintId_generatorVersion: { generatorVersion: parsed.generatorVersion, puzzleBlueprintId: parsed.puzzleBlueprintId } },
  });
  if (!version) throw new PuzzleAuthoringConflictError(`Puzzle Blueprint version ${parsed.puzzleBlueprintId}@${parsed.generatorVersion} does not exist.`);
  return { key: deterministicPuzzlePreviewKey(parsed), timerStarted: false as const };
}
