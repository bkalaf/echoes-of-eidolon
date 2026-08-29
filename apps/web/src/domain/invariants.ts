import { z } from "zod";

import { ArchitectDepartment, AwarenessSkill, CompanionKey, Heirloom, KnowledgeSkill, PuzzleDifficultyTier, PuzzleFamily, WorldKey as PrismaWorldKey } from "../generated/prisma/enums";
import { witnessDefIdSchema } from "./architect-witness";
import type { Character, Companion, CompanionDef, PuzzleBlueprint, Witness, WorldKey } from "./types";

export const witnessSchema = z
  .object({
    characterId: z.string().min(1),
    witnessDefId: z.string().regex(/^WDF_[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
    trueFlawName: z.string().min(1).nullish(),
    architectCharacterId: z.string().min(1),
    legendaryRewardId: z.string().min(1).nullish(),
    constellationBeforeId: z.string().min(1).nullish(),
    constellationAfterId: z.string().min(1).nullish(),
  }).strict() satisfies z.ZodType<Witness>;

export const witnessDefSchema = z.object({
  witnessDefId: witnessDefIdSchema,
  name: z.string().min(1),
  department: z.enum(ArchitectDepartment),
  kernelKey: z.string().trim().min(1),
  apparentDomain: z.string().min(1),
  realDomain: z.string().min(1),
  color: z.object({
    SPECTRAL_VIOLET: z.number().min(0).max(100),
    GREEN: z.number().min(0).max(100),
    WHITE: z.number().min(0).max(100),
  }).strict(),
  architectSoulId: z.string().regex(/^SOUL_[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
  worldKey: z.enum(PrismaWorldKey),
  bookNumber: z.number().int().min(1).max(18),
}).strict().superRefine((definition, context) => {
  const total = Object.values(definition.color).reduce((sum, percentage) => sum + percentage, 0);
  if (Math.abs(total - 100) > 0.000001) context.addIssue({ code: "custom", message: "WitnessDef color percentages must total 100." });
});

/**
 * Concrete Witness transformation preserves Soul identity. The Witness
 * Character and its source Architect Character are distinct Character records
 * but must reference the same Character.soulId.
 */
export function assertWitnessArchitectSoulContinuity(
  witnessCharacter: { characterId: string; soulId?: string | null },
  architectCharacter: { characterId: string; soulId?: string | null },
): void {
  if (
    witnessCharacter.characterId === architectCharacter.characterId
    || !witnessCharacter.soulId
    || !architectCharacter.soulId
    || witnessCharacter.soulId !== architectCharacter.soulId
  ) {
    throw new Error("Witness and source Architect must reference the same Soul.");
  }
}

export function assertDistinctWitnessSoulChains(
  chains: readonly {
    architect: { characterId: string; soulId?: string | null };
    witness: { characterId: string; soulId?: string | null };
  }[],
): void {
  for (const chain of chains) assertWitnessArchitectSoulContinuity(chain.witness, chain.architect);
  const architectSoulIds = chains.map(({ architect }) => architect.soulId);
  if (new Set(architectSoulIds).size !== architectSoulIds.length) {
    throw new Error("Paired Witness components must retain independent Soul identities.");
  }
}

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
  knowledgeSkill: z.enum(KnowledgeSkill).nullable(),
  awarenessSkill: z.enum(AwarenessSkill).nullable(),
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
