export const settlementPopulationEventKinds = [
  "FOUNDING",
  "GROWTH",
  "MIGRATION_IN",
  "MIGRATION_OUT",
] as const;

export type SettlementPopulationEventKind = (typeof settlementPopulationEventKinds)[number];

export interface BreedIdentity {
  breedId: string;
  speciesId: string;
  name: string;
  cultureId: string | null;
}

export interface BreedPopulationAmount {
  breedId: string;
  amount: number;
}

export interface SettlementPopulationEvent {
  settlementWorldId: string;
  year: number;
  sequence: number;
  eventType: SettlementPopulationEventKind;
  breedId: string;
  populationDelta: number;
}

export interface SettlementPopulationProjection {
  populations: ReadonlyMap<string, number>;
  totalPopulation: number;
  dominantBreedId: string | null;
  cultureId: string | null;
}

function compareBreed(a: Pick<BreedIdentity, "name" | "breedId">, b: Pick<BreedIdentity, "name" | "breedId">) {
  return a.name.localeCompare(b.name) || a.breedId.localeCompare(b.breedId);
}

function requireSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer.`);
}

function requireUniqueBreeds(breeds: readonly BreedIdentity[]) {
  if (breeds.length === 0) throw new Error("At least one Breed is required.");
  if (new Set(breeds.map((breed) => breed.breedId)).size !== breeds.length) {
    throw new Error("Duplicate Breed identities are not allowed.");
  }
}

export function allocateInitialFounders(breeds: readonly BreedIdentity[]): BreedPopulationAmount[] {
  requireUniqueBreeds(breeds);
  const speciesIds = new Set(breeds.map((breed) => breed.speciesId));
  if (speciesIds.size !== 1) throw new Error("Founder allocation must contain Breeds from exactly one Species.");

  const ordered = [...breeds].sort(compareBreed);
  const base = Math.floor(1600 / ordered.length);
  const remainder = 1600 % ordered.length;
  return ordered.map((breed, index) => ({ breedId: breed.breedId, amount: base + (index < remainder ? 1 : 0) }));
}

export function apportionFoundingArrival(
  departures: readonly BreedPopulationAmount[],
  breeds: readonly BreedIdentity[],
): { totalDeparting: number; totalArriving: number; arrivals: BreedPopulationAmount[] } {
  requireUniqueBreeds(breeds);
  const identities = new Map(breeds.map((breed) => [breed.breedId, breed]));
  if (departures.length === 0) throw new Error("Founding departures cannot be empty.");
  if (new Set(departures.map((entry) => entry.breedId)).size !== departures.length) {
    throw new Error("Founding departures cannot repeat a Breed.");
  }
  for (const departure of departures) {
    requireSafeInteger(departure.amount, "Departure amount");
    if (departure.amount <= 0) throw new Error("Founding departures must be positive integers.");
    if (!identities.has(departure.breedId)) throw new Error(`Unknown Breed ${departure.breedId}.`);
  }

  const totalDeparting = departures.reduce((sum, entry) => sum + entry.amount, 0);
  const totalArriving = Math.ceil(totalDeparting * 0.9);
  const shares = departures.map((departure) => {
    const numerator = departure.amount * totalArriving;
    return {
      breed: identities.get(departure.breedId)!,
      amount: Math.floor(numerator / totalDeparting),
      remainder: numerator % totalDeparting,
    };
  });
  const undistributed = totalArriving - shares.reduce((sum, share) => sum + share.amount, 0);
  const remainderOrder = [...shares].sort((a, b) => b.remainder - a.remainder || compareBreed(a.breed, b.breed));
  for (let index = 0; index < undistributed; index += 1) remainderOrder[index]!.amount += 1;
  return {
    totalDeparting,
    totalArriving,
    arrivals: shares.sort((a, b) => compareBreed(a.breed, b.breed)).map((share) => ({ breedId: share.breed.breedId, amount: share.amount })),
  };
}

export function replaySettlementPopulation(
  settlementWorldId: string,
  events: readonly SettlementPopulationEvent[],
  breeds: readonly BreedIdentity[],
): SettlementPopulationProjection {
  requireUniqueBreeds(breeds);
  const identities = new Map(breeds.map((breed) => [breed.breedId, breed]));
  const orderKeys = new Set<string>();
  const ordered = [...events].sort((a, b) => a.year - b.year || a.sequence - b.sequence);
  const populations = new Map<string, number>();

  for (const event of ordered) {
    if (event.settlementWorldId !== settlementWorldId) throw new Error("Population event belongs to another SettlementWorld.");
    requireSafeInteger(event.year, "Population event year");
    requireSafeInteger(event.sequence, "Population event sequence");
    requireSafeInteger(event.populationDelta, "Population delta");
    if (!identities.has(event.breedId)) throw new Error(`Unknown Breed ${event.breedId}.`);
    const orderKey = `${event.year}:${event.sequence}`;
    if (orderKeys.has(orderKey)) throw new Error(`Duplicate population event order ${orderKey}.`);
    orderKeys.add(orderKey);
    const next = (populations.get(event.breedId) ?? 0) + event.populationDelta;
    if (next < 0) throw new Error(`Population for ${event.breedId} cannot become negative.`);
    populations.set(event.breedId, next);
  }

  const ranked = breeds
    .filter((breed) => (populations.get(breed.breedId) ?? 0) > 0)
    .sort((a, b) => (populations.get(b.breedId) ?? 0) - (populations.get(a.breedId) ?? 0) || compareBreed(a, b));
  const dominant = ranked[0] ?? null;
  return {
    populations,
    totalPopulation: [...populations.values()].reduce((sum, population) => sum + population, 0),
    dominantBreedId: dominant?.breedId ?? null,
    cultureId: dominant?.cultureId ?? null,
  };
}

const sitePriority = ["METROPOLIS", "CITY", "TOWN", "VILLAGE", "HAMLET"] as const;

export function selectResetSeedSites<T extends { siteId: string; regionId: string; candidateType: string }>(sites: readonly T[]): T[] {
  const grouped = new Map<string, T[]>();
  for (const site of sites) {
    const priority = sitePriority.indexOf(site.candidateType as (typeof sitePriority)[number]);
    if (priority < 0) throw new Error(`Unsupported Site candidate type ${site.candidateType}.`);
    grouped.set(site.regionId, [...(grouped.get(site.regionId) ?? []), site]);
  }
  return [...grouped.entries()]
    .sort(([regionA], [regionB]) => regionA.localeCompare(regionB))
    .map(([, candidates]) => candidates.sort((a, b) => sitePriority.indexOf(a.candidateType as (typeof sitePriority)[number]) - sitePriority.indexOf(b.candidateType as (typeof sitePriority)[number]) || a.siteId.localeCompare(b.siteId))[0]!);
}
