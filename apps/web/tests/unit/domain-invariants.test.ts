import { describe, expect, it } from "vitest";

import {
  calendarContract,
  companionDefSchema,
  migrationConservesBreedPopulation,
  planMigration,
  puzzleBlueprintSchema,
  validateCompanionWorldSlots,
  witnessSchema,
} from "../../src/domain/invariants";

describe("canonical domain invariants", () => {
  it("requires canonical direct Witness subtype bindings", () => {
    expect(witnessSchema.parse({ witnessId: "WIT-1", characterId: "CHAR-1", witnessDefId: "WDEF-1", trueFlawName: "Pride", architectId: "ARCH-1", legendaryRewardId: "REWARD-1" })).toMatchObject({ characterId: "CHAR-1", witnessDefId: "WDEF-1" });
  });

  it("requires three distinct Characters in matching CompanionDef world and Soul slots", () => {
    const companion = companionDefSchema.parse({
      companionKey: "A",
      concordCharacterId: "CHAR-1",
      ruinCharacterId: "CHAR-2",
      schismCharacterId: "CHAR-3",
      soulId: "SOUL-1",
      heirloom: "NECKLACE",
      knowledgeSkill: "LORE",
      awarenessSkill: "EMPATHY",
    });
    expect(validateCompanionWorldSlots(companion, [
      { characterId: "CHAR-1", displayName: "C", breedId: "B1", worldKey: "CONCORD", soulId: "SOUL-1" },
      { characterId: "CHAR-2", displayName: "R", breedId: "B2", worldKey: "RUIN", soulId: "SOUL-1" },
      { characterId: "CHAR-3", displayName: "S", breedId: "B3", worldKey: "SCHISM", soulId: "SOUL-1" },
    ])).toEqual(companion);
    expect(() => validateCompanionWorldSlots(companion, [
      { characterId: "CHAR-1", displayName: "C", breedId: "B1", worldKey: "RUIN", soulId: "SOUL-1" },
    ])).toThrow("CONCORD CompanionDef slot requires a CONCORD Character");
  });

  it("keeps mutable root fields separate from immutable Puzzle Blueprint versions", () => {
    const blueprint = puzzleBlueprintSchema.parse({
      puzzleBlueprintId: "PUZ-1",
      title: "Puzzle",
      primaryFamily: "LOGIC_CONSTRAINT",
      difficultyTier: "TIER_3_EXPERT",
    });
    expect(blueprint).not.toHaveProperty("hint1");
    expect(blueprint).not.toHaveProperty("generatorVersion");
    expect(puzzleBlueprintSchema.safeParse({
      ...blueprint,
      generatorVersion: 1,
    }).success).toBe(false);
  });

  it("plans same-world migration with exact Breed conservation", () => {
    const plan = planMigration({
      worldKey: "CONCORD",
      year: 12,
      originSettlementId: "SET-1",
      destinationSettlementId: "SET-2",
      rows: [
        { breedId: "BREED-1", population: 10 },
        { breedId: "BREED-2", population: 4 },
      ],
    });
    expect(migrationConservesBreedPopulation(plan)).toBe(true);
  });

  it("preserves the authoritative calendar constants", () => {
    expect(calendarContract).toEqual({
      monthsPerYear: 18,
      daysPerMonth: 27,
      preYearStoryDays: 3,
      countedWeekdays: 8,
      excludedWeekday: "Sonntag",
    });
  });
});
