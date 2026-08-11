import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { atlasConnections, atlasRegionMappings } from "../../src/data/atlas-topology";
import { latticeForRegion, regionForLattice, validateAtlasTopology } from "../../src/domain/atlas-topology";
import { omitCopiedLatticeId, projectAtlasCatalog, type AtlasCatalog } from "../../src/server/atlas";

const topology = validateAtlasTopology({ connections: atlasConnections, mappings: atlasRegionMappings });

describe("canonical Atlas Region Mapping and Lattice topology", () => {
  it("contains one locked mapping for every distinct RegionId and LatticeId", () => {
    expect(topology.mappings).toHaveLength(25);
    expect(new Set(topology.mappings.map(({ regionId }) => regionId)).size).toBe(25);
    expect(new Set(topology.mappings.map(({ latticeId }) => latticeId)).size).toBe(25);
    expect(topology.mappings.every(({ locked }) => locked)).toBe(true);
  });

  it("resolves both directions through Region Mapping without suffix inference", () => {
    expect(latticeForRegion(topology, "R01")).toBe("L03");
    expect(regionForLattice(topology, "L03")).toBe("R01");
    expect(latticeForRegion(topology, "R01")).not.toBe("L01");
    expect(latticeForRegion(topology, "R06")).toBe("L14");
  });

  it("contains exactly the 44 unique locked undirected Lattice connections", () => {
    expect(topology.connections).toHaveLength(44);
    expect(new Set(topology.connections.map(({ fromLatticeId, toLatticeId }) => [fromLatticeId, toLatticeId].sort().join(":"))).size).toBe(44);
    expect(topology.connections.every(({ locked }) => locked)).toBe(true);
  });

  it("preserves the canonical connection type and wrap configuration", () => {
    expect(topology.connections.filter(({ connectionType }) => connectionType === "BASE")).toHaveLength(38);
    expect(topology.connections.filter(({ connectionType }) => connectionType === "NORMAL")).toEqual([
      expect.objectContaining({ fromLatticeId: "L04", toLatticeId: "L11", wrapMode: "NONE" }),
    ]);
    const crossovers = topology.connections.filter(({ connectionType }) => connectionType === "LEFT_RIGHT_CROSSOVER");
    expect(crossovers).toHaveLength(5);
    expect(crossovers.every(({ wrapMode }) => wrapMode === "DATE_LINE")).toBe(true);
    expect(topology.connections.some((connection) => "pole" in connection || String(connection.wrapMode).includes("POLE"))).toBe(false);
  });

  it("uses only finite LatticeId endpoints", () => {
    const finite = new Set(Array.from({ length: 25 }, (_, index) => `L${String(index + 1).padStart(2, "0")}`));
    expect(topology.connections.every(({ fromLatticeId, toLatticeId }) => finite.has(fromLatticeId) && finite.has(toLatticeId))).toBe(true);
  });

  it("derives API lattice projections through mapping and leaves physical coordinates unchanged", () => {
    const catalog: AtlasCatalog = {
      releaseId: "TEST",
      worldId: "EIDOLON",
      coordinateReferenceSystem: "EPSG:4326",
      pointsOfInterest: [{ poiId: "POI-1", workingLabel: "Point", displayName: null, nameStatus: "WORKING", category: "TEST", latitude: 12, longitude: 34, regionId: "R01" }],
      settlementSites: [{ siteId: "SITE-1", classification: "CITY", latitude: 56, longitude: 78, regionId: "R01" }],
    };
    const before = projectAtlasCatalog(catalog, topology);
    const remapped = topology.mappings.map((mapping) => mapping.regionId === "R01" ? { ...mapping, latticeId: "L04" as const } : mapping.regionId === "R04" ? { ...mapping, latticeId: "L03" as const } : mapping);
    const after = projectAtlasCatalog(catalog, { ...topology, mappings: remapped });
    expect(before.pointsOfInterest[0]).toMatchObject({ latticeId: "L03", latitude: 12, longitude: 34 });
    expect(after.pointsOfInterest[0]).toMatchObject({ latticeId: "L04", latitude: 12, longitude: 34 });
    expect(after.settlementSites[0]).toMatchObject({ latticeId: "L04", latitude: 56, longitude: 78 });
    expect(catalog.pointsOfInterest[0]).not.toHaveProperty("latticeId");
    expect(catalog.settlementSites[0]).not.toHaveProperty("latticeId");
  });

  it("discards copied lattice fields from site-enriched reference artifacts", () => {
    expect(omitCopiedLatticeId({ siteId: "SITE-1", regionId: "R01", latticeId: "L01", latitude: 1, longitude: 2 })).toEqual({
      siteId: "SITE-1", regionId: "R01", latitude: 1, longitude: 2,
    });
  });

  it("has no Lattice entity/table and removes only the polluted Matrix entity forward", () => {
    const schema = readFileSync(resolve(import.meta.dirname, "../../prisma/schema.prisma"), "utf8");
    const migration = readFileSync(resolve(import.meta.dirname, "../../prisma/migrations/20260810280000_atlas_region_lattice_topology/migration.sql"), "utf8");
    expect(schema).toContain("enum LatticeId {");
    expect(schema).not.toMatch(/^model Lattice\s*\{/m);
    expect(schema).not.toMatch(/^model Matrix\s*\{/m);
    expect(schema).toMatch(/^model RegionLatticeMapping\s*\{/m);
    expect(schema).toMatch(/^model AtlasConnection\s*\{/m);
    expect(migration).toContain('DROP TABLE "Matrix"');
    expect(migration).not.toContain('CREATE TABLE "Lattice"');
  });
});
