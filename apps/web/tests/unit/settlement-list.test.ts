import { describe, expect, it, vi } from "vitest";

import { listSettlementWorlds } from "../../src/server/settlements";

function world(totalPopulation = 8) {
  return {
    culture: { cultureId: "CULTURE-1", name: "Culture" },
    dominantBreed: { breedId: "BREED-1", name: "Breed" },
    populationEvents: [
      { breedId: "BREED-1", populationDelta: 10, year: 1 },
      { breedId: "BREED-1", populationDelta: -2, year: 2 },
    ],
    settlement: { classification: "CITY", name: "City", settlementId: "SET-1", site: { latitude: 1, longitude: 2, regionId: "R01", siteId: "SITE-1" } },
    settlementWorldId: "SW-1",
    totalPopulation,
    worldKey: "CONCORD",
  };
}

describe("Settlement list projection", () => {
  it("derives current Breed counts and latest year from the append-only population ledger", async () => {
    const findMany = vi.fn().mockResolvedValue([world()]);
    const result = await listSettlementWorlds("CONCORD", { settlementWorld: { findMany } } as never);
    expect(result[0]).toMatchObject({ latestYear: 2, populations: [{ breedId: "BREED-1", population: 8 }], totalPopulation: 8 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { worldKey: "CONCORD" } }));
  });

  it("fails closed when the stored total drifts from the event ledger", async () => {
    await expect(listSettlementWorlds("CONCORD", { settlementWorld: { findMany: vi.fn().mockResolvedValue([world(9)]) } } as never)).rejects.toThrow(/drifted/);
  });
});
