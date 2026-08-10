import { describe, expect, it, vi } from "vitest";

import type { CanonicalSettlementSite } from "../../src/server/atlas";
import { importCanonicalSites } from "../../src/server/atlas-sites";

function sites(): CanonicalSettlementSite[] {
  return Array.from({ length: 400 }, (_, index) => ({
    siteId: `SITE-${String(index + 1).padStart(4, "0")}`,
    regionId: `R${String((index % 25) + 1).padStart(2, "0")}`,
    classification: ["HAMLET", "VILLAGE", "TOWN", "CITY", "METROPOLIS"][index % 5]!,
    latitude: -80 + index / 10,
    longitude: -170 + index / 10,
  }));
}

describe("canonical Atlas Site import", () => {
  it("creates all 400 mirrors in one transaction", async () => {
    const findUnique = vi.fn(async () => null);
    const create = vi.fn(async () => undefined);
    const transaction = { site: { findUnique, create } };
    const database = { $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) };
    await expect(importCanonicalSites(sites(), database)).resolves.toEqual({ created: 400, unchanged: 0 });
    expect(database.$transaction).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledTimes(400);
  });

  it("is idempotent for exact mirrors and refuses canonical drift", async () => {
    const canonical = sites();
    const exactById = new Map(canonical.map((site) => [site.siteId, {
      siteId: site.siteId, regionId: site.regionId, candidateType: site.classification,
      latitude: site.latitude, longitude: site.longitude,
    }]));
    const create = vi.fn(async () => undefined);
    const exactTransaction = { site: { findUnique: vi.fn(async ({ where }: { where: { siteId: string } }) => exactById.get(where.siteId)!), create } };
    const exactDatabase = { $transaction: (work: (value: typeof exactTransaction) => Promise<unknown>) => work(exactTransaction) };
    await expect(importCanonicalSites(canonical, exactDatabase)).resolves.toEqual({ created: 0, unchanged: 400 });
    expect(create).not.toHaveBeenCalled();

    const driftTransaction = { site: { findUnique: vi.fn(async () => ({ ...exactById.get(canonical[0]!.siteId)!, latitude: 0 })), create } };
    const driftDatabase = { $transaction: (work: (value: typeof driftTransaction) => Promise<unknown>) => work(driftTransaction) };
    await expect(importCanonicalSites(canonical, driftDatabase)).rejects.toThrow(/canonical Atlas drift/i);
  });

  it("fails before persistence on wrong count, duplicate IDs, or unknown finite values", async () => {
    const database = { $transaction: vi.fn() };
    await expect(importCanonicalSites(sites().slice(0, 399), database)).rejects.toThrow(/exactly 400/);
    const duplicate = sites();
    duplicate[1] = { ...duplicate[1]!, siteId: duplicate[0]!.siteId };
    await expect(importCanonicalSites(duplicate, database)).rejects.toThrow(/identities must be unique/);
    const unknown = sites();
    unknown[0] = { ...unknown[0]!, classification: "CAPITAL" };
    await expect(importCanonicalSites(unknown, database)).rejects.toThrow(/unregistered classification/);
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});
