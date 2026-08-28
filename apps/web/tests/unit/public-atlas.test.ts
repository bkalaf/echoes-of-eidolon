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
const continents = [
  { continentName: "Raukaam", labelLatitude: 41.093565, labelLongitude: -98.497755 },
  { continentName: "Morgenland", labelLatitude: 30.236775, labelLongitude: 73.727394 },
  { continentName: "Valdmere", labelLatitude: -44.543435, labelLongitude: -31.900026 },
];
const geographicPoints = Array.from({ length: 87 }, (_, index) => ({
  category: index === 86 ? "OCEAN" : "PEAK",
  latitude: 80 - index % 80 * 2,
  longitude: -170 + index % 85 * 4,
  name: index === 86 ? "Northern Ocean" : `Geographic Feature ${index + 1}`,
  poiId: `POI-${String(index + 1).padStart(3, "0")}`,
  regionId: regionIds[index % regionIds.length]!,
}));
const authority = { continents, foundingCitySites, geographicPoints, regions };
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
    expect(result.regions).toContainEqual({ color: "#228B22", name: "Innerwood", regionId: "R10" });
    expect(result.continents).toEqual([
      { latitude: 30.236775, longitude: 73.727394, name: "Morgenland" },
      { latitude: 41.093565, longitude: -98.497755, name: "Raukaam" },
      { latitude: -44.543435, longitude: -31.900026, name: "Valdmere" },
    ]);
    expect(result.geographicPoints).toHaveLength(87);
    expect(result).not.toHaveProperty("pointsOfInterest");
  });

  it("exposes only the allowlisted public city, Region, mapping, and connection fields", () => {
    const result = projectPublicAtlas(authority, topology);

    expect(Object.keys(result).sort()).toEqual(["connections", "continents", "foundingCities", "geographicPoints", "regionMappings", "regions"]);
    expect(Object.keys(result.foundingCities[0]!).sort()).toEqual(["latitude", "longitude", "name", "regionColor", "regionId", "siteId"]);
    expect(Object.keys(result.continents[0]!).sort()).toEqual(["latitude", "longitude", "name"]);
    expect(Object.keys(result.geographicPoints[0]!).sort()).toEqual(["category", "latitude", "longitude", "name", "poiId", "regionId"]);
    expect(Object.keys(result.regions[0]!).sort()).toEqual(["color", "name", "regionId"]);
    expect(Object.keys(result.connections[0]!).sort()).toEqual(["atlasConnectionId", "fromLatticeId", "toLatticeId"]);
    expect(Object.keys(result.regionMappings[0]!).sort()).toEqual(["latticeId", "regionId"]);
    expect(JSON.stringify(result)).not.toMatch(/classification|worldKey|workingLabel|isOriginal|existsAtInitial|settlement/i);
  });

  it.each([
    ["wrong count", foundingCitySites.slice(0, -1)],
    ["duplicate Site", foundingCitySites.map((site, index) => index === 1 ? { ...site, siteId: foundingCitySites[0]!.siteId } : site)],
    ["duplicate Region", foundingCitySites.map((site, index) => index === 1 ? { ...site, regionId: "R01" as const } : site)],
    ["R10 initial city", foundingCitySites.map((site) => site.regionId === "R10" ? { ...site, existsAtInitialFounding: true, isOriginalFoundingCity: true } : site)],
    ["blank name", foundingCitySites.map((site) => site.regionId === "R01" ? { ...site, cityDisplayName: " " } : site)],
    ["invalid coordinates", foundingCitySites.map((site) => site.regionId === "R01" ? { ...site, latitude: 91 } : site)],
  ])("fails loudly for %s", (_label, invalidSites) => {
    expect(() => projectPublicAtlas({ continents, foundingCitySites: invalidSites, geographicPoints, regions }, topology)).toThrow(/public Atlas founding city authority/i);
  });

  it("fails loudly when continent or geographic label authority is incomplete", () => {
    expect(() => projectPublicAtlas({ ...authority, continents: continents.slice(0, 2) }, topology)).toThrow(/continent/i);
    expect(() => projectPublicAtlas({ ...authority, geographicPoints: geographicPoints.slice(0, -1) }, topology)).toThrow(/geographic/i);
    expect(() => projectPublicAtlas({ ...authority, geographicPoints: geographicPoints.map((point, index) => index === 1 ? { ...point, poiId: geographicPoints[0]!.poiId } : point) }, topology)).toThrow(/duplicate geographic/i);
  });

  it("does not query or append a hidden SettlementWorld projection", () => {
    const route = readFileSync(resolve(import.meta.dirname, "../../src/routes/api/atlas/public.ts"), "utf8");
    expect(route).toContain("getAtlasReleaseBundle");
    expect(route).toContain("getAtlasTopology");
    expect(route).not.toMatch(/getAtlasCatalogProjection|getDatabase|settlementWorld|RUIN/);
  });
});
