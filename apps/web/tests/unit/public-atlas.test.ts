import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { atlasConnections, atlasRegionMappings } from "../../src/data/atlas-topology";
import { RegionId } from "../../src/generated/prisma/enums";
import { projectPublicAtlas } from "../../src/domain/public-atlas";

const regionIds = Object.values(RegionId);
const regions = regionIds.map((regionId) => ({ displayName: regionId === "R10" ? "Innerwood" : `Region ${regionId}`, regionId }));
const foundingCitySites = regionIds.map((regionId, index) => ({
  cityDisplayName: regionId === "R10" ? "Ashgarden [C] / Second Song [S] / Last Well [R]" : `Founding City ${regionId}`,
  classification: "METROPOLIS",
  existsAtInitialFounding: regionId !== "R10",
  isOriginalFoundingCity: regionId !== "R10",
  latitude: 80 - index * 6,
  longitude: -170 + index * 14,
  regionId,
  siteId: `SITE-${String(index + 1).padStart(4, "0")}`,
  surfaceType: "LAND",
}));
const authority = { foundingCitySites, regions };
const topology = { connections: atlasConnections, mappings: atlasRegionMappings };

describe("public Atlas projection", () => {
  it("does not let the root Atlas dataset ignore rule hide application source routes", () => {
    const gitignore = readFileSync(resolve(import.meta.dirname, "../../../../.gitignore"), "utf8");
    expect(gitignore).toContain("/atlas/");
    expect(gitignore).not.toMatch(/^atlas\/$/m);
  });

  it("projects exactly the 24 original initial founding cities and 25 Regions", () => {
    const result = projectPublicAtlas(authority, topology);

    expect(result.foundingCities).toHaveLength(24);
    expect(new Set(result.foundingCities.map(({ siteId }) => siteId))).toHaveProperty("size", 24);
    expect(new Set(result.foundingCities.map(({ regionId }) => regionId))).toHaveProperty("size", 24);
    expect(result.foundingCities.some(({ regionId }) => regionId === "R10")).toBe(false);
    expect(result.regions).toHaveLength(25);
    expect(result.regions).toContainEqual({ color: "#E66A00", name: "Innerwood", regionId: "R10" });
    expect(result).not.toHaveProperty("pointsOfInterest");
  });

  it("exposes only the allowlisted public city, Region, mapping, and connection fields", () => {
    const result = projectPublicAtlas(authority, topology);

    expect(Object.keys(result).sort()).toEqual(["connections", "foundingCities", "regionMappings", "regions"]);
    expect(Object.keys(result.foundingCities[0]!).sort()).toEqual(["latitude", "longitude", "name", "regionColor", "regionId", "siteId"]);
    expect(Object.keys(result.regions[0]!).sort()).toEqual(["color", "name", "regionId"]);
    expect(Object.keys(result.connections[0]!).sort()).toEqual(["atlasConnectionId", "fromLatticeId", "toLatticeId"]);
    expect(Object.keys(result.regionMappings[0]!).sort()).toEqual(["latticeId", "regionId"]);
    expect(JSON.stringify(result)).not.toMatch(/classification|world|poi|workingLabel|isOriginal|existsAtInitial/i);
  });

  it.each([
    ["wrong count", foundingCitySites.slice(0, -1)],
    ["duplicate Site", foundingCitySites.map((site, index) => index === 1 ? { ...site, siteId: foundingCitySites[0]!.siteId } : site)],
    ["duplicate Region", foundingCitySites.map((site, index) => index === 1 ? { ...site, regionId: "R01" as const } : site)],
    ["R10 initial city", foundingCitySites.map((site) => site.regionId === "R10" ? { ...site, existsAtInitialFounding: true, isOriginalFoundingCity: true } : site)],
    ["blank name", foundingCitySites.map((site) => site.regionId === "R01" ? { ...site, cityDisplayName: " " } : site)],
    ["invalid coordinates", foundingCitySites.map((site) => site.regionId === "R01" ? { ...site, latitude: 91 } : site)],
  ])("fails loudly for %s", (_label, invalidSites) => {
    expect(() => projectPublicAtlas({ foundingCitySites: invalidSites, regions }, topology)).toThrow(/public Atlas founding city authority/i);
  });

  it("does not query or append a hidden SettlementWorld projection", () => {
    const route = readFileSync(resolve(import.meta.dirname, "../../src/routes/api/atlas/public.ts"), "utf8");
    expect(route).toContain("getAtlasReleaseBundle");
    expect(route).toContain("getAtlasTopology");
    expect(route).not.toMatch(/getAtlasCatalogProjection|getDatabase|settlementWorld|RUIN/);
  });
});
