import { z } from "zod";

import type { BreedPopulation, PuzzleBlueprint, Witness, WorldKey } from "./types";

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
  generatorVersion: z.number().int().positive(),
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
