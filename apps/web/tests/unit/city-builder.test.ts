import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { CityBuilderConflictError, createCityProject, saveCityGeometry } from "../../src/server/city-builder";

function geometryDatabase(options: { buildingCityId?: string; cityExists?: boolean; parcelCityId?: string; streetCityId?: string } = {}) {
  const client = {
    building: {
      findUnique: vi.fn().mockResolvedValue(options.buildingCityId ? { cityId: options.buildingCityId } : null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    city: {
      findUnique: vi.fn().mockResolvedValue(options.cityExists === false ? null : { cityId: "CITY-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    parcel: {
      findUnique: vi.fn().mockResolvedValue(options.parcelCityId ? { cityId: options.parcelCityId } : null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    street: {
      findUnique: vi.fn().mockResolvedValue(options.streetCityId ? { cityId: options.streetCityId } : null),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
  const database = {
    $transaction: vi.fn(async (work: (transaction: typeof client) => Promise<unknown>) => work(client)),
  } as unknown as PrismaClient;
  return { client, database };
}

describe("City Builder canonical geometry service", () => {
  it("upserts one owned Parcel and advances the shared City geometry version", async () => {
    const { client, database } = geometryDatabase();
    client.city.findUnique.mockResolvedValueOnce({ cityId: "CITY-1" }).mockResolvedValueOnce({
      buildings: [], cityId: "CITY-1", geometryVersion: 2, name: "Anchor", parcels: [], settlementWorld: {}, streets: [],
    });

    await saveCityGeometry("CITY-1", { action: "upsertParcel", geometry: { points: [[0, 0]] }, parcelId: "PARCEL-1" }, database);

    expect(client.parcel.upsert).toHaveBeenCalledWith({
      create: { cityId: "CITY-1", geometry: { points: [[0, 0]] }, parcelId: "PARCEL-1" },
      update: { geometry: { points: [[0, 0]] } },
      where: { parcelId: "PARCEL-1" },
    });
    expect(client.city.update).toHaveBeenCalledWith({ data: { geometryVersion: { increment: 1 } }, where: { cityId: "CITY-1" } });
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("rejects a geometry ID already owned by another City", async () => {
    const { client, database } = geometryDatabase({ streetCityId: "CITY-2" });
    await expect(saveCityGeometry("CITY-1", { action: "upsertStreet", geometry: [], streetId: "STREET-1" }, database)).rejects.toThrow(CityBuilderConflictError);
    expect(client.street.upsert).not.toHaveBeenCalled();
    expect(client.city.update).not.toHaveBeenCalled();
  });

  it("rejects a Building association to a Parcel outside the City", async () => {
    const { client, database } = geometryDatabase({ parcelCityId: "CITY-2" });
    await expect(saveCityGeometry("CITY-1", { action: "upsertBuilding", buildingId: "BUILDING-1", geometry: {}, parcelId: "PARCEL-1" }, database)).rejects.toThrow(/does not belong to City/);
    expect(client.building.upsert).not.toHaveBeenCalled();
    expect(client.city.update).not.toHaveBeenCalled();
  });

  it("creates a City project only from a canonically named SettlementWorld", async () => {
    const create = vi.fn().mockResolvedValue({ cityId: "generated" });
    const database = {
      city: { create, findUnique: vi.fn().mockResolvedValue(null) },
      settlementWorld: { findUnique: vi.fn().mockResolvedValue({ settlement: { name: "Anchor" }, settlementWorldId: "SW-1" }) },
    } as unknown as PrismaClient;
    await createCityProject({ settlementWorldId: "SW-1" }, database);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: "Anchor", settlementWorldId: "SW-1" }) }));
  });

  it("does not invent a City name for an unnamed Settlement", async () => {
    const database = {
      city: { create: vi.fn(), findUnique: vi.fn() },
      settlementWorld: { findUnique: vi.fn().mockResolvedValue({ settlement: { name: null }, settlementWorldId: "SW-1" }) },
    } as unknown as PrismaClient;
    await expect(createCityProject({ settlementWorldId: "SW-1" }, database)).rejects.toThrow(/canonical name/);
    expect(database.city.create).not.toHaveBeenCalled();
  });
});
