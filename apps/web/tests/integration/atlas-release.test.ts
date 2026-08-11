import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { loadAtlasRelease } from "../../src/server/atlas";
import { importCanonicalSites } from "../../src/server/atlas-sites";

const releaseRoot = resolve(
  import.meta.dirname,
  "../../../../EIDOLON_ATLAS_RECON_NIMBUS_P3V6_20260809_R08_CANONICAL_INTEGRATION_RELEASE",
);

describe("canonical Atlas release", () => {
  it("validates the exact release root and loads its locked records", async () => {
    const catalog = await loadAtlasRelease(releaseRoot);
    expect(catalog.releaseId).toBe("ORBIT_M7Q4_ATLAS_DATA_RELEASE_V1");
    expect(catalog.coordinateReferenceSystem).toBe("EPSG:4326");
    expect(catalog.pointsOfInterest).toHaveLength(92);
    expect(catalog.settlementSites).toHaveLength(400);
    expect(catalog.pointsOfInterest.every((point) => !("latticeId" in point))).toBe(true);
    expect(catalog.settlementSites.every((site) => !("latticeId" in site))).toBe(true);

    const created: unknown[] = [];
    const transaction = { site: { findUnique: async () => null, create: async (input: unknown) => { created.push(input); } } };
    const database = { $transaction: (work: (value: typeof transaction) => Promise<unknown>) => work(transaction) };
    await expect(importCanonicalSites(catalog.settlementSites, database)).resolves.toEqual({ created: 400, unchanged: 0 });
    expect(created).toHaveLength(400);
  }, 30_000);
});
