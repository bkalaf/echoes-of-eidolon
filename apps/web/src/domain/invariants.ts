import { z } from "zod";

import type { BreedPopulation, Companion, Protagonist, PuzzleBlueprint, Witness, WorldKey } from "./types";

export const witnessSchema = z
  .object({
    witnessId: z.string().min(1),
    antagonist1Id: z.string().min(1),
    antagonist2Id: z.string().min(1).nullish(),
  })
  .refine(
    (witness) =>
      !witness.antagonist2Id || witness.antagonist1Id !== witness.antagonist2Id,
    { message: "A Witness must reference one or two distinct Antagonists" },
  ) satisfies z.ZodType<Witness>;

export const companionSchema = z.object({
  companionKey: z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]),
  concordProtagonistId: z.string().min(1),
  ruinProtagonistId: z.string().min(1),
  schismProtagonistId: z.string().min(1),
  soulId: z.string().min(1),
  heirloom: z.enum([
    "NECKLACE", "BRACELET", "EARRINGS", "CLOAK_CLASP", "LIGHTER", "POCKETWATCH",
    "COIN_HEAD_BLACKENED", "COIN_TAIL_BLACKENED", "RING", "TATTOO", "BIRTHMARK",
    "BROOCH", "HAIR_BARRETTE", "BELT_BUCKLE", "BACKPACK_CLASP",
  ]),
}).refine((companion) => new Set([
  companion.concordProtagonistId,
  companion.ruinProtagonistId,
  companion.schismProtagonistId,
]).size === 3, {
  message: "A Companion requires three distinct Protagonists",
}) satisfies z.ZodType<Companion>;

export function validateCompanionWorldSlots(
  companionInput: Companion,
  protagonists: readonly Protagonist[],
): Companion {
  const companion = companionSchema.parse(companionInput);
  const protagonistsById = new Map(protagonists.map((protagonist) => [protagonist.protagonistId, protagonist]));
  const slots = [
    ["CONCORD", companion.concordProtagonistId],
    ["RUIN", companion.ruinProtagonistId],
    ["SCHISM", companion.schismProtagonistId],
  ] as const;
  for (const [worldKey, protagonistId] of slots) {
    if (protagonistsById.get(protagonistId)?.worldKey !== worldKey) {
      throw new Error(`${worldKey} Companion slot requires a ${worldKey} Protagonist`);
    }
  }
  return companion;
}

export const puzzleBlueprintSchema = z.object({
  puzzleBlueprintId: z.string().min(1),
  family: z.string().min(1),
  difficultyTier: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  hint1: z.string().min(1),
  hint2: z.string().min(1),
  generatorVersion: z.number().int(),
}) satisfies z.ZodType<PuzzleBlueprint>;

const migrationRowSchema = z.object({
  breedId: z.string().min(1),
  population: z.number().int().positive(),
});

export const migrationRequestSchema = z
  .object({
    worldKey: z.enum(["CONCORD", "RUIN", "SCHISM"]),
    year: z.number().int(),
    originSettlementId: z.string().min(1),
    destinationSettlementId: z.string().min(1),
    rows: z.array(migrationRowSchema).min(1),
  })
  .refine((request) => request.originSettlementId !== request.destinationSettlementId, {
    message: "Origin and destination Settlements must be distinct",
  })
  .refine(
    (request) => new Set(request.rows.map((row) => row.breedId)).size === request.rows.length,
    { message: "Each Breed may appear once per migration" },
  );

export type MigrationRequest = z.infer<typeof migrationRequestSchema>;

export interface MigrationPlan {
  worldKey: WorldKey;
  year: number;
  origin: BreedPopulation[];
  destination: BreedPopulation[];
}

export function planMigration(input: MigrationRequest): MigrationPlan {
  const request = migrationRequestSchema.parse(input);
  return {
    worldKey: request.worldKey,
    year: request.year,
    origin: request.rows.map((row) => ({
      settlementId: request.originSettlementId,
      worldKey: request.worldKey,
      year: request.year,
      breedId: row.breedId,
      population: -row.population,
    })),
    destination: request.rows.map((row) => ({
      settlementId: request.destinationSettlementId,
      worldKey: request.worldKey,
      year: request.year,
      breedId: row.breedId,
      population: row.population,
    })),
  };
}

export function migrationConservesBreedPopulation(plan: MigrationPlan): boolean {
  const totals = new Map<string, number>();
  for (const row of [...plan.origin, ...plan.destination]) {
    totals.set(row.breedId, (totals.get(row.breedId) ?? 0) + row.population);
  }
  return [...totals.values()].every((total) => total === 0);
}

export const calendarContract = Object.freeze({
  monthsPerYear: 18,
  daysPerMonth: 27,
  preYearStoryDays: 3,
  countedWeekdays: 8,
  excludedWeekday: "Sonntag",
});
