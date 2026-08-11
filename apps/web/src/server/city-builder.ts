import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";

const geometrySchema = z.unknown().refine(
  (value) => value !== null && typeof value === "object",
  "Geometry must be a JSON object or array.",
);

export const cityGeometryMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("upsertParcel"), geometry: geometrySchema, parcelId: z.string().trim().min(1).max(120) }).strict(),
  z.object({ action: z.literal("upsertStreet"), geometry: geometrySchema, streetId: z.string().trim().min(1).max(120) }).strict(),
  z.object({ action: z.literal("upsertBuilding"), buildingId: z.string().trim().min(1).max(120), geometry: geometrySchema, parcelId: z.string().trim().min(1).max(120).nullable() }).strict(),
]);

export const createCityProjectSchema = z.object({ settlementWorldId: z.string().trim().min(1) }).strict();

export class CityBuilderConflictError extends Error {}

const cityInclude = {
  buildings: { orderBy: { buildingId: "asc" as const } },
  parcels: { orderBy: { parcelId: "asc" as const } },
  settlementWorld: { include: { settlement: { include: { site: true } } } },
  streets: { orderBy: { streetId: "asc" as const } },
};

export async function listCityProjects(database: PrismaClient = getDatabase()) {
  const [cities, availableSettlementWorlds] = await Promise.all([
    database.city.findMany({ include: cityInclude, orderBy: { name: "asc" } }),
    database.settlementWorld.findMany({
      include: { settlement: { include: { site: true } } },
      orderBy: [{ worldKey: "asc" }, { settlementId: "asc" }],
      where: { cities: { none: {} } },
    }),
  ]);
  return { availableSettlementWorlds, cities };
}

export async function getCityProject(cityId: string, database: PrismaClient = getDatabase()) {
  const city = await database.city.findUnique({ include: cityInclude, where: { cityId } });
  if (!city) throw new CityBuilderConflictError(`City project ${cityId} does not exist.`);
  return city;
}

export async function createCityProject(
  input: z.infer<typeof createCityProjectSchema>,
  database: PrismaClient = getDatabase(),
) {
  const parsed = createCityProjectSchema.parse(input);
  const settlementWorld = await database.settlementWorld.findUnique({
    include: { settlement: true },
    where: { settlementWorldId: parsed.settlementWorldId },
  });
  if (!settlementWorld) throw new CityBuilderConflictError(`SettlementWorld ${parsed.settlementWorldId} does not exist.`);
  if (!settlementWorld.settlement.name) {
    throw new CityBuilderConflictError("The Settlement must have a canonical name before a City geometry project can be created.");
  }
  const existing = await database.city.findUnique({ where: { settlementWorldId: parsed.settlementWorldId } });
  if (existing) throw new CityBuilderConflictError(`SettlementWorld ${parsed.settlementWorldId} already owns City project ${existing.cityId}.`);
  return database.city.create({
    data: {
      cityId: randomUUID(),
      name: settlementWorld.settlement.name,
      settlementWorldId: parsed.settlementWorldId,
    },
    include: cityInclude,
  });
}

type CityGeometryMutation = z.infer<typeof cityGeometryMutationSchema>;

export async function saveCityGeometry(
  cityId: string,
  input: CityGeometryMutation,
  database: PrismaClient = getDatabase(),
) {
  const parsed = cityGeometryMutationSchema.parse(input);
  return database.$transaction(async (transaction) => {
    const city = await transaction.city.findUnique({ where: { cityId } });
    if (!city) throw new CityBuilderConflictError(`City project ${cityId} does not exist.`);

    if (parsed.action === "upsertParcel") {
      const existing = await transaction.parcel.findUnique({ where: { parcelId: parsed.parcelId } });
      if (existing && existing.cityId !== cityId) throw new CityBuilderConflictError(`parcelId ${parsed.parcelId} already belongs to a different City.`);
      await transaction.parcel.upsert({
        create: { cityId, geometry: parsed.geometry, parcelId: parsed.parcelId },
        update: { geometry: parsed.geometry },
        where: { parcelId: parsed.parcelId },
      });
    } else if (parsed.action === "upsertStreet") {
      const existing = await transaction.street.findUnique({ where: { streetId: parsed.streetId } });
      if (existing && existing.cityId !== cityId) throw new CityBuilderConflictError(`streetId ${parsed.streetId} already belongs to a different City.`);
      await transaction.street.upsert({
        create: { cityId, geometry: parsed.geometry, streetId: parsed.streetId },
        update: { geometry: parsed.geometry },
        where: { streetId: parsed.streetId },
      });
    } else {
      const existing = await transaction.building.findUnique({ where: { buildingId: parsed.buildingId } });
      if (existing && existing.cityId !== cityId) throw new CityBuilderConflictError(`buildingId ${parsed.buildingId} already belongs to a different City.`);
      if (parsed.parcelId) {
        const parcel = await transaction.parcel.findUnique({ where: { parcelId: parsed.parcelId } });
        if (!parcel || parcel.cityId !== cityId) {
          throw new CityBuilderConflictError(`Parcel ${parsed.parcelId} does not belong to City ${cityId}.`);
        }
      }
      await transaction.building.upsert({
        create: { buildingId: parsed.buildingId, cityId, geometry: parsed.geometry, parcelId: parsed.parcelId },
        update: { geometry: parsed.geometry, parcelId: parsed.parcelId },
        where: { buildingId: parsed.buildingId },
      });
    }

    await transaction.city.update({ data: { geometryVersion: { increment: 1 } }, where: { cityId } });
    return getCityProject(cityId, transaction as PrismaClient);
  }, { isolationLevel: "Serializable" });
}
