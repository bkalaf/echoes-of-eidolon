import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { projectPublicAtlas } from "../../src/domain/public-atlas";

describe("public Atlas projection", () => {
  it("does not let the root Atlas dataset ignore rule hide application source routes", () => {
    const gitignore = readFileSync(resolve(import.meta.dirname, "../../../../.gitignore"), "utf8");
    expect(gitignore).toContain("/atlas/");
    expect(gitignore).not.toMatch(/^atlas\/$/m);
  });

  it("allowlists public-safe fields while preserving renderable topology", () => {
    const result = projectPublicAtlas({
      connections: [{ atlasConnectionId: "C1", connectionType: "BASE", fromLatticeId: "L01", locked: true, toLatticeId: "L02", wrapMode: "NONE" }],
      coordinateReferenceSystem: "EPSG:4326",
      pointsOfInterest: [{ category: "WATERFALL", displayName: null, featureId: "PRIVATE-FEATURE", isMagical: true, isRuntimeEffectAnchor: true, latticeId: "L01", latitude: 1, longitude: 2, nameStatus: "WORKING", poiId: "POI-1", primaryBiomeId: "SECRET", regionId: "R01", workingLabel: "Visible Waterfall" }],
      regionMappings: [{ latticeId: "L01", locked: true, regionId: "R01" }],
      releaseId: "release",
      settlementSites: [],
      worldId: "physical-authority",
    }, [{ settlement: { classification: "CITY", name: "Last Well", settlementId: "S1", site: { latitude: 3, longitude: 4, regionId: "R01", siteId: "SITE-1" } } }]);
    expect(result).toEqual({
      connections: [{ atlasConnectionId: "C1", fromLatticeId: "L01", toLatticeId: "L02" }],
      pointsOfInterest: [{ category: "WATERFALL", displayName: null, latticeId: "L01", latitude: 1, longitude: 2, poiId: "POI-1", regionId: "R01", workingLabel: "Visible Waterfall" }, { category: "CITY", displayName: "Last Well", latticeId: "L01", latitude: 3, longitude: 4, poiId: "SETTLEMENT:S1", regionId: "R01", workingLabel: "Last Well" }],
      regionMappings: [{ latticeId: "L01", regionId: "R01" }],
    });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|SECRET|isMagical|runtime/i);
  });

  it("selects the Ruin settlement projection internally without making it a public control", () => {
    const route = readFileSync(resolve(import.meta.dirname, "../../src/routes/api/atlas/public.ts"), "utf8");
    expect(route).toContain('where: { worldKey: "RUIN" }');
    expect(route).not.toContain("searchParams");
  });
});
