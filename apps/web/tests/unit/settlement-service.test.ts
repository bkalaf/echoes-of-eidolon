import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { completeSettlementNaming, foundCity, migratePopulation } from "../../src/server/settlements";

function databaseFor(transaction: Record<string, unknown>) {
  const database = {
    $transaction: vi.fn(async (work, options) => work(transaction, options)),
  };
  return database as unknown as PrismaClient;
}

function transactionBase() {
  return {
    breed: { findMany: vi.fn() },
    promptRecord: { create: vi.fn() },
    promptVersion: { findUnique: vi.fn() },
    settlement: { create: vi.fn(), update: vi.fn() },
    settlementPopulationEvent: { createMany: vi.fn() },
    settlementWorld: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    site: { findUnique: vi.fn() },
  };
}

describe("settlement transaction service", () => {
  it("founds one destination atomically with loss, origin debits, caches, and the supplied naming prompt", async () => {
    const transaction = transactionBase();
    transaction.site.findUnique.mockResolvedValue({
      candidateType: "CITY",
      settlement: null,
      siteId: "SITE-1",
    });
    transaction.settlementWorld.findUnique.mockImplementation(async ({ where }) => {
      if (where.settlementWorldId === "SW-ORIGIN") {
        return {
          populationEvents: [{ breedId: "BREED-A", eventType: "FOUNDING", populationDelta: 10, sequence: 1, year: 1 }],
          settlementId: "SET-ORIGIN",
          settlementWorldId: "SW-ORIGIN",
          worldKey: "CONCORD",
        };
      }
      return null;
    });
    transaction.breed.findMany.mockResolvedValue([
      { breedId: "BREED-A", cultureId: "CULTURE-A", name: "Alpha", speciesId: "SPECIES-A" },
    ]);
    const database = databaseFor(transaction);

    const result = await foundCity({
      departures: [{ amount: 10, breedId: "BREED-A", originSettlementWorldId: "SW-ORIGIN" }],
      prompt: {
        promptText: "OWNER SUPPLIED NAMING PROMPT",
        purpose: "OWNER_SUPPLIED_PURPOSE",
        responseContract: { type: "object" },
        status: "OUTSTANDING",
      },
      siteId: "SITE-1",
      worldKey: "CONCORD",
      year: 2,
    }, database);

    expect(result).toMatchObject({
      promptText: "OWNER SUPPLIED NAMING PROMPT",
      siteId: "SITE-1",
      totalArriving: 9,
      totalDeparting: 10,
    });
    expect(transaction.settlementPopulationEvent.createMany).toHaveBeenCalledTimes(2);
    expect(transaction.settlementPopulationEvent.createMany).toHaveBeenNthCalledWith(1, {
      data: [expect.objectContaining({
        breedId: "BREED-A",
        eventType: "MIGRATION_OUT",
        populationDelta: -10,
        settlementWorldId: "SW-ORIGIN",
        year: 2,
      })],
    });
    expect(transaction.settlementPopulationEvent.createMany).toHaveBeenNthCalledWith(2, {
      data: [expect.objectContaining({
        breedId: "BREED-A",
        eventType: "FOUNDING",
        populationDelta: 9,
        settlementWorldId: result.settlementWorldId,
        year: 2,
      })],
    });
    expect(transaction.settlementWorld.update).toHaveBeenCalledWith({
      where: { settlementWorldId: result.settlementWorldId },
      data: { cultureId: "CULTURE-A", dominantBreedId: "BREED-A", totalPopulation: 9 },
    });
    expect(transaction.promptRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        family: "NAMING",
        purpose: "OWNER_SUPPLIED_PURPOSE",
        status: "OUTSTANDING",
        targetId: result.settlementWorldId,
        targetType: "SettlementWorld",
        versions: {
          create: expect.objectContaining({
            promptText: "OWNER SUPPLIED NAMING PROMPT",
            responseContract: { type: "object" },
            version: 1,
          }),
        },
      }),
    });
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("rejects an excessive departure before writing any population event", async () => {
    const transaction = transactionBase();
    transaction.site.findUnique.mockResolvedValue({ candidateType: "TOWN", settlement: null, siteId: "SITE-1" });
    transaction.settlementWorld.findUnique.mockResolvedValue({
      populationEvents: [{ breedId: "BREED-A", eventType: "FOUNDING", populationDelta: 4, sequence: 1, year: 1 }],
      settlementId: "SET-ORIGIN",
      settlementWorldId: "SW-ORIGIN",
      worldKey: "CONCORD",
    });
    transaction.breed.findMany.mockResolvedValue([
      { breedId: "BREED-A", cultureId: null, name: "Alpha", speciesId: "SPECIES-A" },
    ]);

    await expect(foundCity({
      departures: [{ amount: 5, breedId: "BREED-A", originSettlementWorldId: "SW-ORIGIN" }],
      prompt: { promptText: "PROMPT", purpose: "PURPOSE", responseContract: {}, status: "READY" },
      siteId: "SITE-1",
      worldKey: "CONCORD",
      year: 1,
    }, databaseFor(transaction))).rejects.toThrow(/exceeds the projected origin Breed population/);
    expect(transaction.settlementPopulationEvent.createMany).not.toHaveBeenCalled();
  });

  it("migrates equal per-Breed amounts between existing Settlements in one WorldKey", async () => {
    const transaction = transactionBase();
    transaction.settlementWorld.findUnique.mockImplementation(async ({ where }) => {
      const origin = where.settlementId_worldKey.settlementId === "SET-1";
      return {
        populationEvents: origin
          ? [{ breedId: "BREED-A", eventType: "FOUNDING", populationDelta: 10, sequence: 1, year: 1 }]
          : [{ breedId: "BREED-B", eventType: "FOUNDING", populationDelta: 5, sequence: 1, year: 1 }],
        settlementId: origin ? "SET-1" : "SET-2",
        settlementWorldId: origin ? "SW-1" : "SW-2",
        worldKey: "RUIN",
      };
    });
    transaction.breed.findMany.mockResolvedValue([
      { breedId: "BREED-A", cultureId: "CULTURE-A", name: "Alpha", speciesId: "SPECIES-A" },
      { breedId: "BREED-B", cultureId: "CULTURE-B", name: "Beta", speciesId: "SPECIES-B" },
    ]);

    await migratePopulation({
      destinationSettlementId: "SET-2",
      originSettlementId: "SET-1",
      rows: [{ amount: 3, breedId: "BREED-A" }],
      worldKey: "RUIN",
      year: 2,
    }, databaseFor(transaction));

    expect(transaction.settlementPopulationEvent.createMany).toHaveBeenNthCalledWith(1, {
      data: [expect.objectContaining({ eventType: "MIGRATION_OUT", populationDelta: -3, settlementWorldId: "SW-1" })],
    });
    expect(transaction.settlementPopulationEvent.createMany).toHaveBeenNthCalledWith(2, {
      data: [expect.objectContaining({ eventType: "MIGRATION_IN", populationDelta: 3, settlementWorldId: "SW-2" })],
    });
    expect(transaction.settlementWorld.update).toHaveBeenCalledWith({
      where: { settlementWorldId: "SW-1" },
      data: { cultureId: "CULTURE-A", dominantBreedId: "BREED-A", totalPopulation: 7 },
    });
    expect(transaction.settlementWorld.update).toHaveBeenCalledWith({
      where: { settlementWorldId: "SW-2" },
      data: { cultureId: "CULTURE-B", dominantBreedId: "BREED-B", totalPopulation: 8 },
    });
  });

  it("validates a naming response against the stored version, exact identities, and empty nearby list", async () => {
    const transaction = transactionBase();
    transaction.promptVersion.findUnique.mockResolvedValue({
      promptRecord: {
        family: "NAMING",
        targetId: "SW-1",
        targetType: "SettlementWorld",
      },
      responseContract: {
        additionalProperties: false,
        properties: {
          name: { minLength: 1, type: "string" },
          nearby: { maxItems: 0, type: "array" },
          promptVersionId: { const: "PV-1" },
          settlementId: { const: "SET-1" },
          settlementWorldId: { const: "SW-1" },
          siteId: { const: "SITE-1" },
        },
        required: ["name", "nearby", "promptVersionId", "settlementId", "settlementWorldId", "siteId"],
        type: "object",
      },
    });
    transaction.settlementWorld.findUnique.mockResolvedValue({
      settlementId: "SET-1",
      settlement: { name: null, siteId: "SITE-1" },
    });

    await expect(completeSettlementNaming({
      name: "Supplied Name",
      nearby: [],
      promptVersionId: "PV-1",
      settlementId: "SET-1",
      settlementWorldId: "SW-1",
      siteId: "SITE-1",
    }, databaseFor(transaction))).resolves.toEqual({ name: "Supplied Name", settlementId: "SET-1" });
    expect(transaction.settlement.update).toHaveBeenCalledWith({
      where: { settlementId: "SET-1" },
      data: { name: "Supplied Name" },
    });
  });

  it("rejects returned nearby names and mismatched prompt identities before naming", async () => {
    const transaction = transactionBase();
    await expect(completeSettlementNaming({
      name: "Supplied Name",
      nearby: ["Invented Neighbor"],
      promptVersionId: "PV-1",
      settlementId: "SET-1",
      settlementWorldId: "SW-1",
      siteId: "SITE-1",
    }, databaseFor(transaction))).rejects.toThrow();
    expect(transaction.promptVersion.findUnique).not.toHaveBeenCalled();

    transaction.promptVersion.findUnique.mockResolvedValue({
      promptRecord: { family: "NAMING", targetId: "SW-OTHER", targetType: "SettlementWorld" },
      responseContract: true,
    });
    await expect(completeSettlementNaming({
      name: "Supplied Name",
      nearby: [],
      promptVersionId: "PV-1",
      settlementId: "SET-1",
      settlementWorldId: "SW-1",
      siteId: "SITE-1",
    }, databaseFor(transaction))).rejects.toThrow(/does not match an existing SettlementWorld prompt version/);
    expect(transaction.settlement.update).not.toHaveBeenCalled();
  });
});
