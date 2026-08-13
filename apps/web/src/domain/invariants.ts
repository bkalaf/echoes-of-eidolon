import { z } from "zod";

import { ArchitectDepartment, AwarenessSkill, CompanionKey, Heirloom, KnowledgeSkill, PuzzleDifficultyTier, PuzzleFamily, WitnessColor, WorldKey as PrismaWorldKey } from "../generated/prisma/enums";
import type { Character, Companion, CompanionDef, PuzzleBlueprint, Witness, WorldKey } from "./types";

export const witnessSchema = z
  .object({
    witnessId: z.string().min(1),
    characterId: z.string().min(1),
    witnessDefId: z.string().min(1),
    trueFlawName: z.string().min(1),
    architectId: z.string().min(1),
    legendaryRewardId: z.string().min(1),
    constellationBeforeId: z.string().min(1).nullish(),
    constellationAfterId: z.string().min(1).nullish(),
  }).strict() satisfies z.ZodType<Witness>;

export const witnessDefSchema = z.object({
  witnessDefId: z.string().min(1), name: z.string().min(1), department: z.enum(ArchitectDepartment), apparentDomain: z.string().min(1), realDomain: z.string().min(1), color: z.enum(WitnessColor),
}).strict();

export const companionSchema = z.object({
  characterId: z.string().min(1),
  companionKey: z.enum(CompanionKey),
}).strict() satisfies z.ZodType<Companion>;

export const companionDefSchema = z.object({
  companionKey: z.enum(CompanionKey),
  concordCharacterId: z.string().min(1),
  ruinCharacterId: z.string().min(1),
  schismCharacterId: z.string().min(1),
  soulId: z.string().min(1),
  heirloom: z.enum(Heirloom),
  knowledgeSkill: z.enum(KnowledgeSkill),
  awarenessSkill: z.enum(AwarenessSkill),
}).strict().refine((companionDef) => new Set([
  companionDef.concordCharacterId,
  companionDef.ruinCharacterId,
  companionDef.schismCharacterId,
]).size === 3, {
  message: "A CompanionDef requires three distinct Characters",
}) satisfies z.ZodType<CompanionDef>;

export function validateCompanionWorldSlots(
  companionDefInput: CompanionDef,
  characters: readonly Character[],
): CompanionDef {
  const companionDef = companionDefSchema.parse(companionDefInput);
  const charactersById = new Map(characters.map((character) => [character.characterId, character]));
  const slots = [
    ["CONCORD", companionDef.concordCharacterId],
    ["RUIN", companionDef.ruinCharacterId],
    ["SCHISM", companionDef.schismCharacterId],
  ] as const;
  for (const [worldKey, characterId] of slots) {
    const character = charactersById.get(characterId);
    if (character?.worldKey !== worldKey) {
      throw new Error(`${worldKey} CompanionDef slot requires a ${worldKey} Character`);
    }
    if (character.soulId !== companionDef.soulId) throw new Error(`${worldKey} CompanionDef Character must share Soul ${companionDef.soulId}`);
  }
  return companionDef;
}

export const puzzleBlueprintSchema = z.object({
  puzzleBlueprintId: z.string().min(1),
  title: z.string().min(1),
  primaryFamily: z.enum(PuzzleFamily),
  difficultyTier: z.enum(PuzzleDifficultyTier),
}).strict() satisfies z.ZodType<PuzzleBlueprint>;

const migrationRowSchema = z.object({
  breedId: z.string().min(1),
  population: z.number().int().positive(),
}).strict();

export const migrationRequestSchema = z
  .object({
    worldKey: z.enum(PrismaWorldKey),
    year: z.number().int(),
    originSettlementId: z.string().min(1),
    destinationSettlementId: z.string().min(1),
    rows: z.array(migrationRowSchema).min(1),
  }).strict()
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
