import { randomUUID } from "node:crypto";

import Ajv from "ajv";
import { z } from "zod";

import { Prisma, type PrismaClient } from "../generated/prisma/client";
import type { SettlementPopulationEventType, WorldKey } from "../generated/prisma/enums";
import {
  apportionFoundingArrival,
  replaySettlementPopulation,
  type BreedIdentity,
  type BreedPopulationAmount,
  type SettlementPopulationEvent,
} from "../domain/settlement-population";
import { getDatabase } from "./database";

type Database = PrismaClient;
type Transaction = Parameters<Parameters<Database["$transaction"]>[0]>[0];

interface PopulationWorld {
  settlementWorldId: string;
  settlementId: string;
  worldKey: WorldKey;
  populationEvents: Array<{
    breedId: string;
    eventType: SettlementPopulationEventType;
    populationDelta: number;
    sequence: number;
    year: number;
  }>;
}

export interface FoundCityDeparture {
  amount: number;
  breedId: string;
  originSettlementWorldId: string;
}

export interface FoundCityResult {
  promptText: string;
  promptVersionId: string;
  settlementId: string;
  settlementWorldId: string;
  siteId: string;
  totalArriving: number;
  totalDeparting: number;
}

export async function listSettlementWorlds(worldKey: WorldKey, database: Database = getDatabase()) {
  const worlds = await database.settlementWorld.findMany({
    where: { worldKey },
    orderBy: { settlementId: "asc" },
    select: {
      culture: { select: { cultureId: true, name: true } },
      dominantBreed: { select: { breedId: true, name: true } },
      settlement: {
        select: {
          classification: true,
          name: true,
          settlementId: true,
          site: { select: { latitude: true, longitude: true, regionId: true, siteId: true } },
        },
      },
      settlementWorldId: true,
      totalPopulation: true,
      worldKey: true,
      populationEvents: { orderBy: [{ year: "asc" }, { sequence: "asc" }], select: { breedId: true, populationDelta: true, year: true } },
    },
  });
  return worlds.map((world) => {
    const populationByBreed = new Map<string, number>();
    for (const event of world.populationEvents) populationByBreed.set(event.breedId, (populationByBreed.get(event.breedId) ?? 0) + event.populationDelta);
    const populations = [...populationByBreed].map(([breedId, population]) => ({ breedId, population })).filter((row) => row.population > 0).sort((left, right) => left.breedId.localeCompare(right.breedId));
    const eventTotal = populations.reduce((sum, row) => sum + row.population, 0);
    if (eventTotal !== world.totalPopulation) throw new Error(`SettlementWorld ${world.settlementWorldId} population projection has drifted from its event ledger.`);
    return {
      culture: world.culture,
      dominantBreed: world.dominantBreed,
      latestYear: world.populationEvents.reduce((latest, event) => Math.max(latest, event.year), 0),
      populations,
      settlement: world.settlement,
      settlementWorldId: world.settlementWorldId,
      totalPopulation: world.totalPopulation,
      worldKey: world.worldKey,
    };
  });
}

const settlementNamingResponseSchema = z.object({
  settlement: z.object({ settlementId: z.string().min(1), name: z.string().trim().min(1).max(200) }).strict(),
  features: z.array(z.object({ featureId: z.string().min(1), name: z.string().trim().min(1).max(200) }).strict()),
}).strict();

const namingValidationInputSchema = z.object({ promptVersionId: z.string().min(1), rawResponse: z.string().min(1).max(100_000) }).strict();

function namingPrompt(input: {
  breedPopulations: Array<{ breedId: string; breedName: string; population: number }>;
  culture: { cultureId: string; name: string } | null;
  dominantBreed: { breedId: string; name: string } | null;
  features: Array<{ context: unknown; featureId: string; name: string | null; type: string }>;
  foundingYear: number;
  regionId: string;
  settlementId: string;
  siteContext: unknown;
  siteId: string;
  worldKey: WorldKey;
}) {
  const named = input.features.filter((feature) => feature.name != null);
  const unnamed = input.features.filter((feature) => feature.name == null);
  const context = {
    settlementId: input.settlementId,
    siteId: input.siteId,
    currentWorldContext: input.worldKey,
    foundingYear: input.foundingYear,
    breedPopulations: input.breedPopulations,
    dominantBreed: input.dominantBreed,
    culture: input.culture,
    region: { regionId: input.regionId },
    surroundingTerrain: input.siteContext,
    siteTerrainAndFeatures: input.siteContext,
    eligibleNearbyCanonicalNamedFeatures: named,
    eligibleNearbyCanonicalUnnamedFeatures: unnamed,
  };
  const responseContract = {
    additionalProperties: false,
    properties: {
      settlement: { additionalProperties: false, properties: { settlementId: { const: input.settlementId }, name: { minLength: 1, maxLength: 200, type: "string" } }, required: ["settlementId", "name"], type: "object" },
      features: { items: { additionalProperties: false, properties: { featureId: { enum: unnamed.map((feature) => feature.featureId) }, name: { minLength: 1, maxLength: 200, type: "string" } }, required: ["featureId", "name"], type: "object" }, maxItems: unnamed.length, minItems: unnamed.length, type: "array" },
    },
    required: ["settlement", "features"],
    type: "object",
  };
  const promptText = [
    "Name the newly founded Echoes of Eidolon Settlement and every supplied unnamed eligible nearby feature.",
    "Use only the authoritative context below. Do not infer geographic relationships from display names.",
    "Already-named canonical features are context only and cannot be renamed.",
    "Return exactly one name for the supplied Settlement ID and one name for every supplied unnamed feature ID.",
    "Use exact supplied IDs. Do not invent IDs, omit IDs, duplicate feature IDs, or include named or out-of-set features.",
    "Return only the required JSON object with no prose or Markdown.",
    "",
    "AUTHORITATIVE CONTEXT",
    JSON.stringify(context, null, 2),
    "",
    "REQUIRED RESPONSE CONTRACT",
    JSON.stringify({ settlement: { settlementId: input.settlementId, name: "Proposed City Name" }, features: unnamed.map((feature) => ({ featureId: feature.featureId, name: "Proposed Feature Name" })) }, null, 2),
  ].join("\n");
  return { promptText, responseContract };
}

function eventProjection(world: PopulationWorld, events = world.populationEvents): SettlementPopulationEvent[] {
  return events.map((event) => ({ ...event, settlementWorldId: world.settlementWorldId }));
}

function nextSequence(world: PopulationWorld, year: number): number {
  return world.populationEvents.reduce(
    (highest, event) => event.year === year ? Math.max(highest, event.sequence) : highest,
    0,
  ) + 1;
}

async function loadBreeds(
  transaction: Transaction,
  breedIds: readonly string[],
): Promise<BreedIdentity[]> {
  const uniqueIds = [...new Set(breedIds)];
  const breeds = await transaction.breed.findMany({
    where: { breedId: { in: uniqueIds } },
    select: { breedId: true, cultureId: true, name: true, speciesId: true },
  });
  if (breeds.length !== uniqueIds.length) throw new Error("Every population row must reference an existing Breed.");
  return breeds;
}

function requireYear(year: number) {
  if (!Number.isSafeInteger(year) || year < 0 || year > 4040) throw new Error("Settlement year must be an integer from 0 through 4040.");
}

function requireDepartures(departures: readonly FoundCityDeparture[]) {
  if (departures.length === 0) throw new Error("Found City requires at least one departure.");
  const keys = new Set<string>();
  for (const departure of departures) {
    if (!departure.originSettlementWorldId || !departure.breedId) throw new Error("Every departure requires origin SettlementWorld and Breed identities.");
    if (!Number.isSafeInteger(departure.amount) || departure.amount <= 0) throw new Error("Departure amounts must be positive integers.");
    const key = `${departure.originSettlementWorldId}:${departure.breedId}`;
    if (keys.has(key)) throw new Error("A Found City request cannot repeat an origin SettlementWorld and Breed pair.");
    keys.add(key);
  }
}

async function appendEvents(
  transaction: Transaction,
  world: PopulationWorld,
  year: number,
  eventType: Exclude<SettlementPopulationEventType, "GROWTH">,
  rows: readonly BreedPopulationAmount[],
) {
  let sequence = nextSequence(world, year);
  const additions = rows.map((row) => ({
    breedId: row.breedId,
    eventType,
    populationDelta: eventType === "MIGRATION_OUT" ? -row.amount : row.amount,
    sequence: sequence++,
    year,
  }));
  await transaction.settlementPopulationEvent.createMany({
    data: additions.map((event) => ({
      ...event,
      settlementPopulationEventId: randomUUID(),
      settlementWorldId: world.settlementWorldId,
    })),
  });
  world.populationEvents.push(...additions);
}

async function projectAndPersistWorld(
  transaction: Transaction,
  world: PopulationWorld,
  breeds: readonly BreedIdentity[],
) {
  const projection = replaySettlementPopulation(world.settlementWorldId, eventProjection(world), breeds);
  await transaction.settlementWorld.update({
    where: { settlementWorldId: world.settlementWorldId },
    data: {
      cultureId: projection.cultureId,
      dominantBreedId: projection.dominantBreedId,
      totalPopulation: projection.totalPopulation,
    },
  });
  return projection;
}

export async function foundCity(input: {
  departures: readonly FoundCityDeparture[];
  siteId: string;
  worldKey: WorldKey;
  year: number;
}, database: Database = getDatabase()): Promise<FoundCityResult> {
  requireYear(input.year);
  requireDepartures(input.departures);
  if (!input.siteId) throw new Error("Found City requires a Site identity.");

  return database.$transaction(async (transaction) => {
    const site = await transaction.site.findUnique({
      where: { siteId: input.siteId },
      include: { settlement: true, namingEligibility: { orderBy: { rank: "asc" }, include: { feature: true } } },
    });
    if (!site) throw new Error("Found City requires an existing Site.");
    if (!site.namingContext) throw new Error("Found City requires imported authoritative Site naming context.");

    const existingDestinationWorld = site.settlement
      ? await transaction.settlementWorld.findUnique({
        where: { settlementId_worldKey: { settlementId: site.settlement.settlementId, worldKey: input.worldKey } },
      })
      : null;
    if (existingDestinationWorld) throw new Error("The destination Site already has a Settlement in this WorldKey.");

    const originIds = [...new Set(input.departures.map((departure) => departure.originSettlementWorldId))];
    const origins: PopulationWorld[] = [];
    for (const settlementWorldId of originIds) {
      const origin = await transaction.settlementWorld.findUnique({
        where: { settlementWorldId },
        include: { populationEvents: { orderBy: [{ year: "asc" }, { sequence: "asc" }] } },
      });
      if (!origin || origin.worldKey !== input.worldKey) throw new Error("Every origin must exist in the selected WorldKey.");
      if (origin.settlementId === site.settlement?.settlementId) throw new Error("The destination cannot also be an origin.");
      origins.push(origin);
    }

    const allBreedIds = [
      ...input.departures.map((departure) => departure.breedId),
      ...origins.flatMap((origin) => origin.populationEvents.map((event) => event.breedId)),
    ];
    const breeds = await loadBreeds(transaction, allBreedIds);
    for (const origin of origins) {
      const throughYear = origin.populationEvents.filter((event) => event.year <= input.year);
      const projection = replaySettlementPopulation(origin.settlementWorldId, eventProjection(origin, throughYear), breeds);
      for (const departure of input.departures.filter((row) => row.originSettlementWorldId === origin.settlementWorldId)) {
        if ((projection.populations.get(departure.breedId) ?? 0) < departure.amount) {
          throw new Error("Found City departure exceeds the projected origin Breed population.");
        }
      }
    }

    const aggregateDepartures = new Map<string, number>();
    for (const departure of input.departures) {
      aggregateDepartures.set(departure.breedId, (aggregateDepartures.get(departure.breedId) ?? 0) + departure.amount);
    }
    const transfer = apportionFoundingArrival(
      [...aggregateDepartures].map(([breedId, amount]) => ({ breedId, amount })),
      breeds,
    );

    for (const origin of origins) {
      const rows = input.departures
        .filter((departure) => departure.originSettlementWorldId === origin.settlementWorldId)
        .map(({ amount, breedId }) => ({ amount, breedId }));
      await appendEvents(transaction, origin, input.year, "MIGRATION_OUT", rows);
      await projectAndPersistWorld(transaction, origin, breeds);
    }

    const settlementId = site.settlement?.settlementId ?? randomUUID();
    if (!site.settlement) {
      await transaction.settlement.create({
        data: { classification: site.candidateType, settlementId, siteId: site.siteId },
      });
    }
    const settlementWorldId = randomUUID();
    await transaction.settlementWorld.create({
      data: { settlementId, settlementWorldId, worldKey: input.worldKey },
    });
    const destination: PopulationWorld = {
      populationEvents: [], settlementId, settlementWorldId, worldKey: input.worldKey,
    };
    await appendEvents(transaction, destination, input.year, "FOUNDING", transfer.arrivals);
    const projection = await projectAndPersistWorld(transaction, destination, breeds);
    const culture = projection.cultureId ? await transaction.culture.findUnique({ where: { cultureId: projection.cultureId }, select: { cultureId: true, name: true } }) : null;
    const dominantBreed = breeds.find((breed) => breed.breedId === projection.dominantBreedId) ?? null;
    const prompt = namingPrompt({
      breedPopulations: transfer.arrivals.map((arrival) => ({ breedId: arrival.breedId, breedName: breeds.find((breed) => breed.breedId === arrival.breedId)!.name, population: arrival.amount })),
      culture,
      dominantBreed: dominantBreed ? { breedId: dominantBreed.breedId, name: dominantBreed.name } : null,
      features: site.namingEligibility.map((entry) => ({ context: entry.feature.context, featureId: entry.feature.featureId, name: entry.feature.name, type: entry.feature.featureType })),
      foundingYear: input.year,
      regionId: site.regionId,
      settlementId,
      siteContext: site.namingContext,
      siteId: site.siteId,
      worldKey: input.worldKey,
    });

    const promptRecordId = randomUUID();
    const promptVersionId = randomUUID();
    await transaction.promptRecord.create({
      data: {
        family: "NAMING",
        promptRecordId,
        purpose: "FOUND_CITY_SETTLEMENT_AND_ELIGIBLE_FEATURE_NAMING",
        status: "READY",
        targetId: settlementWorldId,
        targetType: "SettlementWorld",
        versions: {
          create: {
            promptText: prompt.promptText,
            promptVersionId,
            responseContract: prompt.responseContract,
            version: 1,
          },
        },
      },
    });
    return {
      promptText: prompt.promptText,
      promptVersionId,
      settlementId,
      settlementWorldId,
      siteId: site.siteId,
      totalArriving: transfer.totalArriving,
      totalDeparting: transfer.totalDeparting,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function migratePopulation(input: {
  destinationSettlementId: string;
  originSettlementId: string;
  rows: readonly BreedPopulationAmount[];
  worldKey: WorldKey;
  year: number;
}, database: Database = getDatabase()): Promise<void> {
  requireYear(input.year);
  if (input.originSettlementId === input.destinationSettlementId) throw new Error("Migration endpoints must be distinct Settlements.");
  requireDepartures(input.rows.map((row) => ({
    ...row, originSettlementWorldId: input.originSettlementId,
  })));

  await database.$transaction(async (transaction) => {
    const [origin, destination] = await Promise.all([
      transaction.settlementWorld.findUnique({
        where: { settlementId_worldKey: { settlementId: input.originSettlementId, worldKey: input.worldKey } },
        include: { populationEvents: { orderBy: [{ year: "asc" }, { sequence: "asc" }] } },
      }),
      transaction.settlementWorld.findUnique({
        where: { settlementId_worldKey: { settlementId: input.destinationSettlementId, worldKey: input.worldKey } },
        include: { populationEvents: { orderBy: [{ year: "asc" }, { sequence: "asc" }] } },
      }),
    ]);
    if (!origin || !destination) throw new Error("Migration requires both Settlements in the selected WorldKey.");
    const breeds = await loadBreeds(transaction, [
      ...input.rows.map((row) => row.breedId),
      ...origin.populationEvents.map((event) => event.breedId),
      ...destination.populationEvents.map((event) => event.breedId),
    ]);
    const originThroughYear = replaySettlementPopulation(
      origin.settlementWorldId,
      eventProjection(origin, origin.populationEvents.filter((event) => event.year <= input.year)),
      breeds,
    );
    for (const row of input.rows) {
      if ((originThroughYear.populations.get(row.breedId) ?? 0) < row.amount) {
        throw new Error("Migration exceeds the projected origin Breed population.");
      }
    }
    await appendEvents(transaction, origin, input.year, "MIGRATION_OUT", input.rows);
    await appendEvents(transaction, destination, input.year, "MIGRATION_IN", input.rows);
    await projectAndPersistWorld(transaction, origin, breeds);
    await projectAndPersistWorld(transaction, destination, breeds);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function validateSettlementNaming(
  input: unknown,
  database: Database = getDatabase(),
) {
  const request = namingValidationInputSchema.parse(input);
  let parsed: z.infer<typeof settlementNamingResponseSchema>;
  try { parsed = settlementNamingResponseSchema.parse(JSON.parse(request.rawResponse)); }
  catch { throw new Error("Naming response is not the required JSON structure."); }
  return database.$transaction(async (transaction) => {
    const promptVersion = await transaction.promptVersion.findUnique({
      where: { promptVersionId: request.promptVersionId },
      include: { promptRecord: true },
    });
    if (!promptVersion || promptVersion.promptRecord.family !== "NAMING" || promptVersion.promptRecord.targetType !== "SettlementWorld") throw new Error("Naming response does not match an existing SettlementWorld prompt version.");
    const contract = promptVersion.responseContract;
    if (typeof contract !== "boolean" && (contract == null || Array.isArray(contract) || typeof contract !== "object")) throw new Error("Stored naming response contract is not a JSON Schema.");
    const validate = new Ajv({ allErrors: true }).compile(contract);
    if (!validate(parsed)) throw new Error("Naming response does not satisfy the stored response contract or allowed IDs.");
    const featureIds = parsed.features.map((feature) => feature.featureId);
    if (new Set(featureIds).size !== featureIds.length) throw new Error("Naming response contains duplicate feature IDs.");
    const settlementWorld = await transaction.settlementWorld.findUnique({
      where: { settlementWorldId: promptVersion.promptRecord.targetId },
      include: { settlement: { include: { site: { include: { namingEligibility: { include: { feature: true } } } } } } },
    });
    if (!settlementWorld || settlementWorld.settlementId !== parsed.settlement.settlementId) throw new Error("Naming response Settlement ID does not match the persisted prompt target.");
    const allowed = settlementWorld.settlement.site.namingEligibility.filter((entry) => entry.feature.name == null).map((entry) => entry.featureId).sort();
    if (featureIds.slice().sort().join("\n") !== allowed.join("\n")) throw new Error("Naming response must name every and only the persisted allowed unnamed feature IDs.");
    const promptTextResultId = randomUUID();
    await transaction.promptTextResult.create({ data: { parsedResponse: parsed, promptTextResultId, promptVersionId: promptVersion.promptVersionId, rawResponse: request.rawResponse } });
    return { parsedResponse: parsed, promptTextResultId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function applySettlementNames(
  promptTextResultId: string,
  database: Database = getDatabase(),
) {
  if (!promptTextResultId) throw new Error("A validated naming result is required.");
  return database.$transaction(async (transaction) => {
    const result = await transaction.promptTextResult.findUnique({
      where: { promptTextResultId },
      include: { promptVersion: { include: { promptRecord: true } } },
    });
    if (!result || result.promptVersion.promptRecord.family !== "NAMING" || result.promptVersion.promptRecord.targetType !== "SettlementWorld") throw new Error("Validated naming result was not found.");
    const parsed = settlementNamingResponseSchema.parse(result.parsedResponse);
    if (result.appliedAt) return { appliedAt: result.appliedAt, settlementId: parsed.settlement.settlementId };
    const settlementWorld = await transaction.settlementWorld.findUnique({
      where: { settlementWorldId: result.promptVersion.promptRecord.targetId },
      include: { settlement: { include: { site: { include: { namingEligibility: { include: { feature: true } } } } } } },
    });
    if (!settlementWorld || settlementWorld.settlementId !== parsed.settlement.settlementId) throw new Error("Validated naming result no longer matches its Settlement.");
    if (settlementWorld.settlement.name != null) throw new Error("Settlement already has a canonical name.");
    const allowed = new Map(settlementWorld.settlement.site.namingEligibility.filter((entry) => entry.feature.name == null).map((entry) => [entry.featureId, entry.feature]));
    if (parsed.features.length !== allowed.size || parsed.features.some((feature) => !allowed.has(feature.featureId))) throw new Error("Allowed unnamed feature set changed after validation.");
    await transaction.settlement.update({ where: { settlementId: parsed.settlement.settlementId }, data: { name: parsed.settlement.name } });
    for (const feature of parsed.features) {
      const current = allowed.get(feature.featureId)!;
      if (current.name != null) throw new Error(`Feature ${feature.featureId} was named after validation.`);
      await transaction.atlasNameableFeature.update({ where: { featureId: feature.featureId }, data: { name: feature.name } });
    }
    const appliedAt = new Date();
    await transaction.promptTextResult.update({ where: { promptTextResultId }, data: { appliedAt } });
    await transaction.promptRecord.update({ where: { promptRecordId: result.promptVersion.promptRecord.promptRecordId }, data: { status: "COMPLETED" } });
    return { appliedAt, settlementId: parsed.settlement.settlementId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
