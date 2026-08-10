import { z } from "zod";

import type { Companion, Protagonist, PuzzleBlueprint, Witness, WorldKey } from "./types";

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
  family: z.enum(["TEXT_LANGUAGE_LITERARY", "CRYPTO_NUMERIC_DATA", "VISUAL_COLOR_OPTICAL", "SPATIAL_FOLDING_GEOMETRY", "AUDIO_MUSIC_SPECTRAL", "LOGIC_CONSTRAINT", "HISTORICAL_RESEARCH", "CONSTRUCTION_SIMULATION", "CROSS_MODAL"]),
  difficultyTier: z.enum(["TIER_1_INITIATE", "TIER_2_ADEPT", "TIER_3_EXPERT", "TIER_4_MASTER", "TIER_5_ORDEAL"]),
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
  origin: MigrationPopulationDelta[];
  destination: MigrationPopulationDelta[];
}

export interface MigrationPopulationDelta {
  settlementId: string;
  worldKey: WorldKey;
  year: number;
  breedId: string;
  population: number;
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
