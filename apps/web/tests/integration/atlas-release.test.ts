import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { loadAtlasReleaseBundle } from "../../src/server/atlas";
import { importCanonicalSites } from "../../src/server/atlas-sites";
import { atlasConnections, atlasRegionMappings } from "../../src/data/atlas-topology";
import { atlasGeographicPoints } from "../../src/data/atlas-geographic-points";
import { projectPublicAtlas } from "../../src/domain/public-atlas";

const releaseRoot = process.env.EIDOLON_ATLAS_RELEASE_ROOT ?? resolve(
  import.meta.dirname,
  "../../../../EIDOLON_ATLAS_DATASET_R09_AUTHORITATIVE_DEPLOYMENT_V2",
);

describe("canonical Atlas release", () => {
  it("validates the exact R09 deployment dataset and loads its locked records", async () => {
    const release = await loadAtlasReleaseBundle(releaseRoot);
    const catalog = release.catalog;
    expect(catalog.releaseId).toBe("EIDOLON_ATLAS_RECON_NIMBUS_P3V6_R09_AUTHORITATIVE_FULL_ATLAS_RELEASE");
    expect(catalog.coordinateReferenceSystem).toBe("EPSG:4326");
    expect(catalog.pointsOfInterest).toHaveLength(92);
    expect(catalog.settlementSites).toHaveLength(400);
    expect(release.foundingCitySites).toHaveLength(25);
    expect(release.continents).toEqual([
      { continentName: "Raukaam", labelLatitude: 41.093565, labelLongitude: -98.497755 },
      { continentName: "Morgenland", labelLatitude: 30.236775, labelLongitude: 73.727394 },
      { continentName: "Valdmere", labelLatitude: -44.543435, labelLongitude: -31.900026 },
    ]);
    expect(release.authority).toEqual({
      ascendancy: {
        cityName: "Ascendancy",
        latitude: 20.360822,
        longitude: -32.076454,
        regionId: "R06",
        siteId: "SITE-0401",
        surfaceType: "FLOATING_ISLAND",
      },
      continents: ["Raukaam", "Morgenland", "Valdmere"],
      forestfoldPopulation: ["South Asian", "Primates", "Caucasian & Anatolian"],
      highcourtPopulation: ["Iranian, Kurdish & Eastern West Asian", "Angels & Celestials", "Djinn & Genie-Kin"],
      initialOriginalFoundingCities: 24,
      latticeConnections: 44,
      latticeIdEqualsRegionId: false,
      physicalRegions: 25,
      poleCrossovers: 0,
      regionMappingCount: 25,
      r10InitialSettlementExists: false,
      r10PostDjtNames: { C: "Ashgarden", R: "Last Well", S: "Second Song" },
    });
    expect(catalog.pointsOfInterest.every((point) => !("latticeId" in point))).toBe(true);
    expect(catalog.settlementSites.every((site) => !("latticeId" in site))).toBe(true);

    const publicAtlas = projectPublicAtlas({ ...release, geographicPoints: atlasGeographicPoints }, { connections: atlasConnections, mappings: atlasRegionMappings });
    expect(publicAtlas.foundingCities).toHaveLength(24);
    expect(publicAtlas.foundingCities.map(({ regionId }) => regionId)).toEqual([
      "R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09",
      "R11", "R12", "R13", "R14", "R15", "R16", "R17", "R18", "R19",
      "R20", "R21", "R22", "R23", "R24", "R25",
    ]);
    expect(publicAtlas.regions).toContainEqual({ color: "#228B22", name: "Innerwood", regionId: "R10" });
    expect(publicAtlas.continents.map(({ name }) => name)).toEqual(["Morgenland", "Raukaam", "Valdmere"]);
    expect(publicAtlas.geographicPoints).toHaveLength(87);
    expect(publicAtlas.geographicPoints.some(({ name }) => name === "Heavenfall")).toBe(false);
    expect(publicAtlas.geographicPoints).toContainEqual({ category: "OCEAN", latitude: 73, longitude: 0, name: "Northern Ocean", poiId: "POI-091", regionId: "R15" });

    const created: unknown[] = [];
    const transaction = { site: { findUnique: async () => null, create: async (input: unknown) => { created.push(input); } } };
    const database = { $transaction: (work: (value: typeof transaction) => Promise<unknown>) => work(transaction) };
    await expect(importCanonicalSites(catalog.settlementSites, release.foundingCitySites, database)).resolves.toEqual({ created: 401, unchanged: 0 });
    expect(created).toHaveLength(401);
    expect(created).toContainEqual({ data: { candidateType: "METROPOLIS", latitude: 20.360822, longitude: -32.076454, regionId: "R06", siteId: "SITE-0401" } });
  }, 30_000);
});
