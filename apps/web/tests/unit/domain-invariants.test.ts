import { describe, expect, it } from "vitest";

import {
  calendarContract,
  companionSchema,
  migrationConservesBreedPopulation,
  planMigration,
  puzzleBlueprintSchema,
  validateCompanionWorldSlots,
  witnessSchema,
} from "../../src/domain/invariants";

describe("canonical domain invariants", () => {
  it("requires one or two distinct Antagonists on a Witness", () => {
    expect(
      witnessSchema.parse({ witnessId: "WIT-1", antagonist1Id: "ANT-1" }),
    ).toMatchObject({ antagonist1Id: "ANT-1" });
    expect(() =>
      witnessSchema.parse({
        witnessId: "WIT-1",
        antagonist1Id: "ANT-1",
        antagonist2Id: "ANT-1",
      }),
    ).toThrow("distinct Antagonists");
  });

  it("requires three distinct Protagonists in their matching Companion world slots", () => {
    const companion = companionSchema.parse({
      companionKey: "A",
      concordProtagonistId: "PRO-CONCORD",
      ruinProtagonistId: "PRO-RUIN",
      schismProtagonistId: "PRO-SCHISM",
      soulId: "SOUL-1",
      heirloom: "NECKLACE",
    });
    expect(validateCompanionWorldSlots(companion, [
      { protagonistId: "PRO-CONCORD", characterId: "CHAR-1", importance: "MAJOR", worldKey: "CONCORD" },
      { protagonistId: "PRO-RUIN", characterId: "CHAR-2", importance: "MAJOR", worldKey: "RUIN" },
      { protagonistId: "PRO-SCHISM", characterId: "CHAR-3", importance: "MAJOR", worldKey: "SCHISM" },
    ])).toEqual(companion);
    expect(() => validateCompanionWorldSlots(companion, [
      { protagonistId: "PRO-CONCORD", characterId: "CHAR-1", importance: "MAJOR", worldKey: "RUIN" },
    ])).toThrow("CONCORD Companion slot requires a CONCORD Protagonist");
  });

  it("requires exactly two authored Puzzle Blueprint hints", () => {
    const blueprint = puzzleBlueprintSchema.parse({
      puzzleBlueprintId: "PUZ-1",
      family: "sequence",
      difficultyTier: 3,
      hint1: "First authored hint",
      hint2: "Second authored hint",
      generatorVersion: 1,
    });
    expect(Object.keys(blueprint).filter((key) => key.startsWith("hint"))).toEqual([
      "hint1",
      "hint2",
    ]);
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
