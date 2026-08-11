import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { CampaignObjectType } from "../generated/prisma/enums";
import { challengeWindowFromAcceptance } from "../domain/puzzle-blueprint";
import { getDatabase } from "./database";

type Database = PrismaClient;

function acceptanceProjection(acceptedAt: Date, now: Date) {
  const window = challengeWindowFromAcceptance(acceptedAt);
  return {
    acceptedAt: window.acceptedAt.toISOString(),
    endsAt: window.endsAt.toISOString(),
    remainingSeconds: Math.max(0, Math.ceil((window.endsAt.getTime() - now.getTime()) / 1000)),
  };
}

async function assignedPuzzleIds(userId: string, database: Database) {
  const session = await database.gameSession.findFirst({
    where: { userId },
    orderBy: { lastActiveAt: "desc" },
    select: { settlementWorld: { select: { worldKey: true } } },
  });
  const worldKey = session?.settlementWorld?.worldKey;
  if (!worldKey) return [];
  const campaign = await database.campaign.findUnique({
    where: { worldKey },
    select: { placements: { where: { objectType: CampaignObjectType.WITNESS }, orderBy: { ordinal: "asc" }, select: { objectId: true } } },
  });
  const witnessIds = campaign?.placements.map((placement) => placement.objectId) ?? [];
  if (witnessIds.length === 0) return [];
  const witnesses = await database.witness.findMany({
    where: { witnessId: { in: witnessIds } },
    select: {
      antagonist1: { select: { puzzleBlueprintId: true, witnessName: true } },
      antagonist2: { select: { puzzleBlueprintId: true, witnessName: true } },
      witnessId: true,
    },
  });
  const byId = new Map(witnesses.map((witness) => [witness.witnessId, witness]));
  const assigned = campaign!.placements.flatMap((placement) => {
    const witness = byId.get(placement.objectId);
    return witness ? [witness.antagonist1, ...(witness.antagonist2 ? [witness.antagonist2] : [])] : [];
  });
  return assigned.filter((assignment, index) => assigned.findIndex((candidate) => candidate.puzzleBlueprintId === assignment.puzzleBlueprintId) === index)
    .map((assignment) => ({ name: assignment.witnessName, objectId: assignment.puzzleBlueprintId }));
}

export async function getPlayerPuzzleChallenges(userId: string, now = new Date(), database: Database = getDatabase()) {
  const assignments = await assignedPuzzleIds(userId, database);
  if (assignments.length === 0) return { puzzles: [] };
  const names = new Map(assignments.map((assignment) => [assignment.objectId, assignment.name]));
  const blueprints = await database.puzzleBlueprint.findMany({
    where: { puzzleBlueprintId: { in: assignments.map((assignment) => assignment.objectId) } },
    select: {
      difficultyTier: true,
      family: true,
      puzzleBlueprintId: true,
      versions: {
        orderBy: { generatorVersion: "desc" },
        take: 1,
        select: {
          generatorVersion: true,
          hints: { orderBy: { level: "asc" }, select: { kind: true, level: true, template: true } },
          acceptances: { where: { userId }, orderBy: { acceptedAt: "asc" }, take: 1, select: { acceptedAt: true, puzzleChallengeAcceptedId: true } },
        },
      },
    },
  });
  const byId = new Map(blueprints.map((blueprint) => [blueprint.puzzleBlueprintId, blueprint]));
  return {
    puzzles: assignments.flatMap((assignment) => {
      const blueprint = byId.get(assignment.objectId);
      const version = blueprint?.versions[0];
      if (!blueprint || !version) return [];
      const acceptance = version.acceptances[0];
      return [{
        acceptance: acceptance ? { puzzleChallengeAcceptedId: acceptance.puzzleChallengeAcceptedId, ...acceptanceProjection(acceptance.acceptedAt, now) } : null,
        difficultyTier: blueprint.difficultyTier,
        family: blueprint.family,
        generatorVersion: version.generatorVersion,
        hints: acceptance ? version.hints : [],
        name: names.get(blueprint.puzzleBlueprintId) ?? blueprint.puzzleBlueprintId,
        puzzleBlueprintId: blueprint.puzzleBlueprintId,
      }];
    }),
  };
}

export async function acceptPlayerPuzzleChallenge(
  input: { generatorVersion: number; puzzleBlueprintId: string; userId: string },
  now = new Date(),
  database: Database = getDatabase(),
) {
  const assignments = await assignedPuzzleIds(input.userId, database);
  if (!assignments.some((assignment) => assignment.objectId === input.puzzleBlueprintId)) {
    throw new Error("The Puzzle Blueprint is not assigned to the player's current campaign.");
  }
  const version = await database.puzzleBlueprintVersion.findUnique({
    where: { puzzleBlueprintId_generatorVersion: { generatorVersion: input.generatorVersion, puzzleBlueprintId: input.puzzleBlueprintId } },
  });
  if (!version) throw new Error("The assigned Puzzle Blueprint version does not exist.");
  const acceptance = await database.$transaction(async (transaction) => transaction.puzzleChallengeAccepted.upsert({
    where: { userId_puzzleBlueprintId_generatorVersion: input },
    create: { ...input, acceptedAt: now, puzzleChallengeAcceptedId: randomUUID() },
    update: {},
  }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return {
    puzzleChallengeAcceptedId: acceptance.puzzleChallengeAcceptedId,
    puzzleBlueprintId: acceptance.puzzleBlueprintId,
    generatorVersion: acceptance.generatorVersion,
    ...acceptanceProjection(acceptance.acceptedAt, now),
  };
}
