import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { applySettlementNames, foundCity, migratePopulation, validateSettlementNaming } from "../../src/server/settlements";

function databaseFor(transaction: Record<string, unknown>) {
  return {
    $transaction: vi.fn(async (work, options) => work(transaction, options)),
  } as unknown as PrismaClient;
}

function transactionBase() {
  return {
    atlasNameableFeature: { update: vi.fn() },
    breed: { findMany: vi.fn() },
    culture: { findUnique: vi.fn() },
    promptRecord: { create: vi.fn(), update: vi.fn() },
    promptTextResult: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    promptVersion: { findUnique: vi.fn() },
    settlement: { create: vi.fn(), update: vi.fn() },
    settlementPopulationEvent: { createMany: vi.fn() },
    settlementWorld: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    site: { findUnique: vi.fn() },
  };
}

const breed = { breedId: "BREED-A", cultureId: "CULTURE-A", name: "Alpha", speciesId: "SPECIES-A" };

describe("settlement transaction service", () => {
  it("founds atomically from Breed departures and persists an exact server-authored naming prompt", async () => {
    const transaction = transactionBase();
    transaction.site.findUnique.mockResolvedValue({
      candidateType: "CITY",
      namingContext: { siteFeatures: ["ford"], surroundingTerrain: ["grassland"] },
      namingEligibility: [
        { feature: { context: { direction: "north" }, featureId: "FEATURE-NAMED", featureType: "RIVER", name: "Oldwater" } },
        { feature: { context: { direction: "east" }, featureId: "FEATURE-NEW", featureType: "HILL", name: null } },
      ],
      regionId: "R01",
      settlement: null,
      siteId: "SITE-1",
    });
    transaction.settlementWorld.findUnique.mockResolvedValue({
      populationEvents: [{ breedId: "BREED-A", eventType: "FOUNDING", populationDelta: 10, sequence: 1, year: 1 }],
      settlementId: "SET-ORIGIN",
      settlementWorldId: "SW-ORIGIN",
      worldKey: "CONCORD",
    });
    transaction.breed.findMany.mockResolvedValue([breed]);
    transaction.culture.findUnique.mockResolvedValue({ cultureId: "CULTURE-A", name: "Alpha Culture" });
    const database = databaseFor(transaction);

    const result = await foundCity({
      departures: [{ amount: 10, breedId: "BREED-A", originSettlementWorldId: "SW-ORIGIN" }],
      siteId: "SITE-1",
      worldKey: "CONCORD",
      year: 2,
    }, database);

    expect(result).toMatchObject({ siteId: "SITE-1", totalArriving: 9, totalDeparting: 10 });
    expect(transaction.settlementPopulationEvent.createMany).toHaveBeenNthCalledWith(1, {
      data: [expect.objectContaining({ breedId: "BREED-A", eventType: "MIGRATION_OUT", populationDelta: -10, settlementWorldId: "SW-ORIGIN", year: 2 })],
    });
    expect(transaction.settlementPopulationEvent.createMany).toHaveBeenNthCalledWith(2, {
      data: [expect.objectContaining({ breedId: "BREED-A", eventType: "FOUNDING", populationDelta: 9, settlementWorldId: result.settlementWorldId, year: 2 })],
    });
    expect(transaction.settlementWorld.update).toHaveBeenCalledWith({
      where: { settlementWorldId: result.settlementWorldId },
      data: { cultureId: "CULTURE-A", dominantBreedId: "BREED-A", totalPopulation: 9 },
    });
    expect(result.promptText).toContain(`"settlementId": "${result.settlementId}"`);
    expect(result.promptText).toContain('"currentWorldContext": "CONCORD"');
    expect(result.promptText).toContain('"featureId": "FEATURE-NEW"');
    expect(result.promptText).toContain("Do not invent IDs");
    expect(transaction.promptRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      family: "NAMING",
      purpose: "FOUND_CITY_SETTLEMENT_AND_ELIGIBLE_FEATURE_NAMING",
      status: "READY",
      targetId: result.settlementWorldId,
      versions: { create: expect.objectContaining({ promptText: result.promptText, version: 1 }) },
    }) });
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("rejects a projected-year overdraw before any founding write", async () => {
    const transaction = transactionBase();
    transaction.site.findUnique.mockResolvedValue({ candidateType: "TOWN", namingContext: {}, namingEligibility: [], regionId: "R01", settlement: null, siteId: "SITE-1" });
    transaction.settlementWorld.findUnique.mockResolvedValue({
      populationEvents: [{ breedId: "BREED-A", eventType: "FOUNDING", populationDelta: 4, sequence: 1, year: 1 }],
      settlementId: "SET-ORIGIN",
      settlementWorldId: "SW-ORIGIN",
      worldKey: "CONCORD",
    });
    transaction.breed.findMany.mockResolvedValue([breed]);

    await expect(foundCity({
      departures: [{ amount: 5, breedId: "BREED-A", originSettlementWorldId: "SW-ORIGIN" }],
      siteId: "SITE-1",
      worldKey: "CONCORD",
      year: 1,
    }, databaseFor(transaction))).rejects.toThrow(/exceeds the projected origin Breed population/);
    expect(transaction.settlementPopulationEvent.createMany).not.toHaveBeenCalled();
    expect(transaction.settlement.create).not.toHaveBeenCalled();
  });

  it("migrates equal per-Breed amounts between existing Settlements", async () => {
    const transaction = transactionBase();
    transaction.settlementWorld.findUnique.mockImplementation(async ({ where }) => {
      const origin = where.settlementId_worldKey.settlementId === "SET-1";
      return {
        populationEvents: [{ breedId: origin ? "BREED-A" : "BREED-B", eventType: "FOUNDING", populationDelta: origin ? 10 : 5, sequence: 1, year: 1 }],
        settlementId: origin ? "SET-1" : "SET-2",
        settlementWorldId: origin ? "SW-1" : "SW-2",
        worldKey: "RUIN",
      };
    });
    transaction.breed.findMany.mockResolvedValue([
      breed,
      { breedId: "BREED-B", cultureId: "CULTURE-B", name: "Beta", speciesId: "SPECIES-B" },
    ]);

    await migratePopulation({ destinationSettlementId: "SET-2", originSettlementId: "SET-1", rows: [{ amount: 3, breedId: "BREED-A" }], worldKey: "RUIN", year: 2 }, databaseFor(transaction));

    expect(transaction.settlementPopulationEvent.createMany).toHaveBeenNthCalledWith(1, { data: [expect.objectContaining({ eventType: "MIGRATION_OUT", populationDelta: -3, settlementWorldId: "SW-1" })] });
    expect(transaction.settlementPopulationEvent.createMany).toHaveBeenNthCalledWith(2, { data: [expect.objectContaining({ eventType: "MIGRATION_IN", populationDelta: 3, settlementWorldId: "SW-2" })] });
  });

  it("validates exact IDs and stores the raw naming response without applying names", async () => {
    const transaction = transactionBase();
    transaction.promptVersion.findUnique.mockResolvedValue({
      promptRecord: { family: "NAMING", targetId: "SW-1", targetType: "SettlementWorld" },
      promptVersionId: "PV-1",
      responseContract: {
        additionalProperties: false,
        properties: {
          settlement: { additionalProperties: false, properties: { settlementId: { const: "SET-1" }, name: { type: "string" } }, required: ["settlementId", "name"], type: "object" },
          features: { items: { additionalProperties: false, properties: { featureId: { enum: ["FEATURE-NEW"] }, name: { type: "string" } }, required: ["featureId", "name"], type: "object" }, maxItems: 1, minItems: 1, type: "array" },
        },
        required: ["settlement", "features"],
        type: "object",
      },
    });
    transaction.settlementWorld.findUnique.mockResolvedValue({ settlementId: "SET-1", settlement: { site: { namingEligibility: [
      { featureId: "FEATURE-NAMED", feature: { name: "Oldwater" } },
      { featureId: "FEATURE-NEW", feature: { name: null } },
    ] } } });
    const rawResponse = JSON.stringify({ settlement: { settlementId: "SET-1", name: "New City" }, features: [{ featureId: "FEATURE-NEW", name: "New Hill" }] });

    const validated = await validateSettlementNaming({ promptVersionId: "PV-1", rawResponse }, databaseFor(transaction));

    expect(validated).toEqual({ parsedResponse: JSON.parse(rawResponse), promptTextResultId: expect.any(String) });
    expect(transaction.promptTextResult.create).toHaveBeenCalledWith({ data: expect.objectContaining({ promptVersionId: "PV-1", rawResponse }) });
    expect(transaction.settlement.update).not.toHaveBeenCalled();
    expect(transaction.atlasNameableFeature.update).not.toHaveBeenCalled();

    await expect(validateSettlementNaming({
      promptVersionId: "PV-1",
      rawResponse: JSON.stringify({ settlement: { settlementId: "SET-1", name: "New City" }, features: [{ featureId: "FEATURE-NAMED", name: "Stolen Name" }] }),
    }, databaseFor(transaction))).rejects.toThrow(/stored response contract or allowed IDs/);
  });

  it("applies a validated Settlement and allowed unnamed features atomically", async () => {
    const transaction = transactionBase();
    transaction.promptTextResult.findUnique.mockResolvedValue({
      appliedAt: null,
      parsedResponse: { settlement: { settlementId: "SET-1", name: "New City" }, features: [{ featureId: "FEATURE-NEW", name: "New Hill" }] },
      promptVersion: { promptRecord: { family: "NAMING", promptRecordId: "PR-1", targetId: "SW-1", targetType: "SettlementWorld" } },
    });
    transaction.settlementWorld.findUnique.mockResolvedValue({ settlementId: "SET-1", settlement: { name: null, site: { namingEligibility: [
      { featureId: "FEATURE-NAMED", feature: { featureId: "FEATURE-NAMED", name: "Oldwater" } },
      { featureId: "FEATURE-NEW", feature: { featureId: "FEATURE-NEW", name: null } },
    ] } } });
    const database = databaseFor(transaction);

    await expect(applySettlementNames("RESULT-1", database)).resolves.toMatchObject({ settlementId: "SET-1" });
    expect(transaction.settlement.update).toHaveBeenCalledWith({ where: { settlementId: "SET-1" }, data: { name: "New City" } });
    expect(transaction.atlasNameableFeature.update).toHaveBeenCalledWith({ where: { featureId: "FEATURE-NEW" }, data: { name: "New Hill" } });
    expect(transaction.atlasNameableFeature.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { featureId: "FEATURE-NAMED" } }));
    expect(transaction.promptTextResult.update).toHaveBeenCalledWith({ where: { promptTextResultId: "RESULT-1" }, data: { appliedAt: expect.any(Date) } });
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });
});
