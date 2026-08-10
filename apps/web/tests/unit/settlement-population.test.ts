import { describe, expect, it } from "vitest";

import {
  allocateInitialFounders,
  apportionFoundingArrival,
  replaySettlementPopulation,
  selectResetSeedSites,
  type BreedIdentity,
} from "../../src/domain/settlement-population";

const breeds: BreedIdentity[] = [
  { breedId: "BREED-Z", speciesId: "SPECIES-1", name: "Zulu", cultureId: "CULTURE-Z" },
  { breedId: "BREED-A2", speciesId: "SPECIES-1", name: "Alpha", cultureId: null },
  { breedId: "BREED-A1", speciesId: "SPECIES-1", name: "Alpha", cultureId: "CULTURE-A" },
];

describe("settlement population authority", () => {
  it("allocates exactly 1,600 founders across every Breed by name then breedId", () => {
    const allocation = allocateInitialFounders(breeds);
    expect(allocation).toEqual([
      { breedId: "BREED-A1", amount: 534 },
      { breedId: "BREED-A2", amount: 533 },
      { breedId: "BREED-Z", amount: 533 },
    ]);
    expect(allocation.reduce((sum, entry) => sum + entry.amount, 0)).toBe(1600);
  });

  it("fails founder allocation closed for missing, duplicate, or mixed-Species Breeds", () => {
    expect(() => allocateInitialFounders([])).toThrow(/At least one Breed/);
    expect(() => allocateInitialFounders([breeds[0]!, breeds[0]!])).toThrow(/Duplicate Breed/);
    expect(() => allocateInitialFounders([breeds[0]!, { ...breeds[1]!, speciesId: "SPECIES-2" }])).toThrow(/exactly one Species/);
  });

  it("apportions a 90-percent founding arrival by largest remainder and stable Breed tie-breaks", () => {
    const result = apportionFoundingArrival([
      { breedId: "BREED-Z", amount: 1 },
      { breedId: "BREED-A2", amount: 1 },
      { breedId: "BREED-A1", amount: 1 },
    ], breeds);
    expect(result.totalDeparting).toBe(3);
    expect(result.totalArriving).toBe(3);
    expect(result.arrivals).toEqual([
      { breedId: "BREED-A1", amount: 1 },
      { breedId: "BREED-A2", amount: 1 },
      { breedId: "BREED-Z", amount: 1 },
    ]);

    const lossy = apportionFoundingArrival([{ breedId: "BREED-A1", amount: 10 }], breeds);
    expect(lossy.totalArriving).toBe(9);
  });

  it("replays ordered append-only deltas and derives dominant Breed and its actual nullable Culture", () => {
    const projection = replaySettlementPopulation("SW-1", [
      { settlementWorldId: "SW-1", year: 2, sequence: 2, eventType: "GROWTH", breedId: "BREED-A2", populationDelta: 5 },
      { settlementWorldId: "SW-1", year: 1, sequence: 1, eventType: "FOUNDING", breedId: "BREED-A1", populationDelta: 5 },
      { settlementWorldId: "SW-1", year: 2, sequence: 1, eventType: "GROWTH", breedId: "BREED-A1", populationDelta: 0 },
    ], breeds);
    expect(projection.totalPopulation).toBe(10);
    expect(projection.dominantBreedId).toBe("BREED-A1");
    expect(projection.cultureId).toBe("CULTURE-A");
  });

  it("rejects duplicate event order, cross-world events, unknown Breeds, and negative replay", () => {
    const event = { settlementWorldId: "SW-1", year: 1, sequence: 1, eventType: "FOUNDING" as const, breedId: "BREED-A1", populationDelta: 1 };
    expect(() => replaySettlementPopulation("SW-1", [event, { ...event, breedId: "BREED-A2" }], breeds)).toThrow(/Duplicate population event order/);
    expect(() => replaySettlementPopulation("SW-2", [event], breeds)).toThrow(/another SettlementWorld/);
    expect(() => replaySettlementPopulation("SW-1", [{ ...event, breedId: "UNKNOWN" }], breeds)).toThrow(/Unknown Breed/);
    expect(() => replaySettlementPopulation("SW-1", [{ ...event, populationDelta: -1 }], breeds)).toThrow(/cannot become negative/);
  });

  it("selects one reset seed Site per Region by exact type priority then siteId", () => {
    expect(selectResetSeedSites([
      { siteId: "SITE-2", regionId: "REGION-A", candidateType: "CITY" },
      { siteId: "SITE-1", regionId: "REGION-A", candidateType: "CITY" },
      { siteId: "SITE-3", regionId: "REGION-A", candidateType: "TOWN" },
      { siteId: "SITE-9", regionId: "REGION-B", candidateType: "HAMLET" },
    ])).toEqual([
      { siteId: "SITE-1", regionId: "REGION-A", candidateType: "CITY" },
      { siteId: "SITE-9", regionId: "REGION-B", candidateType: "HAMLET" },
    ]);
    expect(() => selectResetSeedSites([{ siteId: "SITE-X", regionId: "REGION-X", candidateType: "CAPITAL" }])).toThrow(/Unsupported Site candidate type/);
  });
});
