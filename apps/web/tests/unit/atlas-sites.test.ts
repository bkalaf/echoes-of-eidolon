import { describe, expect, it, vi } from "vitest";

import type { CanonicalFoundingCitySite, CanonicalSettlementSite } from "../../src/server/atlas";
import { importCanonicalSites } from "../../src/server/atlas-sites";

function sites(): CanonicalSettlementSite[] {
  return Array.from({ length: 400 }, (_, index) => ({
    siteId: `SITE-${String(index + 1).padStart(4, "0")}`,
    regionId: `R${String(Math.floor(index / 16) + 1).padStart(2, "0")}`,
    classification: index % 16 === 0 ? "METROPOLIS" : ["HAMLET", "VILLAGE", "TOWN", "CITY"][index % 4]!,
    latitude: -80 + index / 10,
    longitude: -170 + index / 10,
  }));
}

function foundingSites(physical: CanonicalSettlementSite[]): CanonicalFoundingCitySite[] {
  return [
    ...physical.filter((site) => site.classification === "METROPOLIS" && site.regionId !== "R06").map((site) => ({
      ...site,
      cityDisplayName: `City ${site.regionId}`,
      existsAtInitialFounding: site.regionId !== "R10",
      isOriginalFoundingCity: site.regionId !== "R10",
      surfaceType: "LAND",
    })),
    { cityDisplayName: "Ascendancy", classification: "METROPOLIS", existsAtInitialFounding: true, isOriginalFoundingCity: true, latitude: 20.360822, longitude: -32.076454, regionId: "R06", siteId: "SITE-0401", surfaceType: "FLOATING_ISLAND" },
  ];
}

describe("canonical Atlas Site import", () => {
  it("creates the 400 physical mirrors and the authoritative R09 SITE-0401 addition in one transaction", async () => {
    const enriched = sites();
    (enriched[0] as CanonicalSettlementSite & { latticeId: string }).latticeId = "L01";
    const findUnique = vi.fn(async () => null);
    const create = vi.fn(async () => undefined);
    const transaction = { site: { findUnique, create } };
    const database = { $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) };
    await expect(importCanonicalSites(enriched, foundingSites(enriched), database)).resolves.toEqual({ created: 401, unchanged: 0 });
    expect(database.$transaction).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledTimes(401);
    expect(create.mock.calls[0]![0].data).not.toHaveProperty("latticeId");
    expect(create).toHaveBeenCalledWith({ data: { candidateType: "METROPOLIS", latitude: 20.360822, longitude: -32.076454, regionId: "R06", siteId: "SITE-0401" } });
  });

  it("is idempotent for exact mirrors and refuses canonical drift", async () => {
    const canonical = sites();
    const founding = foundingSites(canonical);
    const exactById = new Map([...canonical, ...founding].map((site) => [site.siteId, {
      siteId: site.siteId, regionId: site.regionId, candidateType: site.classification,
      latitude: site.latitude, longitude: site.longitude,
    }]));
    const create = vi.fn(async () => undefined);
    const exactTransaction = { site: { findUnique: vi.fn(async ({ where }: { where: { siteId: string } }) => exactById.get(where.siteId)!), create } };
    const exactDatabase = { $transaction: (work: (value: typeof exactTransaction) => Promise<unknown>) => work(exactTransaction) };
    await expect(importCanonicalSites(canonical, founding, exactDatabase)).resolves.toEqual({ created: 0, unchanged: 401 });
    expect(create).not.toHaveBeenCalled();

    const driftTransaction = { site: { findUnique: vi.fn(async () => ({ ...exactById.get(canonical[0]!.siteId)!, latitude: 0 })), create } };
    const driftDatabase = { $transaction: (work: (value: typeof driftTransaction) => Promise<unknown>) => work(driftTransaction) };
    await expect(importCanonicalSites(canonical, founding, driftDatabase)).rejects.toThrow(/canonical Atlas drift/i);
  });

  it("fails before persistence on wrong count, duplicate IDs, or unknown finite values", async () => {
    const database = { $transaction: vi.fn() };
    const canonical = sites();
    const founding = foundingSites(canonical);
    await expect(importCanonicalSites(canonical.slice(0, 399), founding, database)).rejects.toThrow(/exactly 400/);
    await expect(importCanonicalSites(canonical, founding.slice(0, 24), database)).rejects.toThrow(/exactly 25/);
    const duplicate = sites();
    duplicate[1] = { ...duplicate[1]!, siteId: duplicate[0]!.siteId };
    await expect(importCanonicalSites(duplicate, foundingSites(duplicate), database)).rejects.toThrow(/identities must be unique/);
    const unknown = sites();
    const unknownFounding = foundingSites(unknown);
    unknown[0] = { ...unknown[0]!, classification: "CAPITAL" };
    await expect(importCanonicalSites(unknown, unknownFounding, database)).rejects.toThrow(/unregistered classification/);
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});
