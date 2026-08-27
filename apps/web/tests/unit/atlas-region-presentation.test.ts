import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createAtlasRegionOverlaySvg, validateAtlasRegionGeoJson } from "../../src/domain/atlas-region-overlay";
import { atlasRegionAdjacency } from "../../src/data/atlas-region-adjacency";
import {
  atlasRegionLabelColor,
  atlasRegionPalette,
  atlasRegionPresentationColors,
} from "../../src/content/atlas-region-presentation";
import managedAssets from "../../src/data/managed-assets.json";

const exactPalette = {
  R01: "#FFFFFF", R02: "#000000", R03: "#A52A2A", R04: "#FFFF00", R05: "#FFA500",
  R06: "#FF0000", R07: "#00FF00", R08: "#00FFFF", R09: "#000080", R10: "#228B22",
  R11: "#800080", R12: "#FFC0CB", R13: "#FFFFFF", R14: "#000000", R15: "#A52A2A",
  R16: "#FFFF00", R17: "#FFA500", R18: "#FF0000", R19: "#00FF00", R20: "#00FFFF",
  R21: "#000080", R22: "#228B22", R23: "#800080", R24: "#FFC0CB", R25: "#FFFFFF",
} as const;

describe("Atlas Region presentation", () => {
  it("uses only the requested 12 named colors for all 25 Regions", () => {
    expect(atlasRegionPalette).toEqual(exactPalette);
    expect(atlasRegionPresentationColors).toEqual({
      BLACK: "#000000", BROWN: "#A52A2A", CYAN: "#00FFFF", FOREST_GREEN: "#228B22",
      LIME: "#00FF00", NAVY_BLUE: "#000080", ORANGE: "#FFA500", PINK: "#FFC0CB",
      PURPLE: "#800080", RED: "#FF0000", WHITE: "#FFFFFF", YELLOW: "#FFFF00",
    });
    expect(new Set(Object.values(atlasRegionPalette))).toEqual(new Set(Object.values(atlasRegionPresentationColors)));
  });

  it("assigns a different color to every neighboring Region and white label text to black Regions", () => {
    for (const [regionId, neighbors] of Object.entries(atlasRegionAdjacency)) {
      for (const neighbor of neighbors) expect(atlasRegionPalette[regionId as keyof typeof atlasRegionPalette]).not.toBe(atlasRegionPalette[neighbor]);
    }
    expect(atlasRegionPalette.R04).toBe("#FFFF00");
    expect(atlasRegionPalette.R06).toBe("#FF0000");
    expect(atlasRegionLabelColor("R02")).toBe("#FFFFFF");
    expect(atlasRegionLabelColor("R06")).toBe("#FF0000");
  });

  it("turns the authoritative 25-feature geography into a deterministic equirectangular overlay", () => {
    const source = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../../EIDOLON_ATLAS_DATASET_R09_AUTHORITATIVE_DEPLOYMENT_V2/data/regions_25.geojson"), "utf8"));
    const geography = validateAtlasRegionGeoJson(source);
    const first = createAtlasRegionOverlaySvg(geography, 8192, 4096);
    const second = createAtlasRegionOverlaySvg(geography, 8192, 4096);

    expect(geography.features).toHaveLength(25);
    expect(new Set(geography.features.map(({ geometry }) => geometry.type))).toEqual(new Set(["Polygon", "MultiPolygon"]));
    const holesByRegion = Object.fromEntries(geography.features.map(({ geometry, properties }) => {
      const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
      return [properties.regionId, polygons.reduce((count, polygon) => count + Math.max(0, polygon.length - 1), 0)];
    }));
    expect(holesByRegion).toMatchObject({ R12: 2, R17: 1, R24: 2 });
    expect(Object.values(holesByRegion).reduce((sum, count) => sum + count, 0)).toBe(5);
    expect(first).toContain('data-region-id="R10"');
    expect(first).toContain('data-region-id="R10"');
    expect(first).toContain('fill="#228B22"');
    expect(first).toContain('fill-rule="evenodd"');
    expect(createHash("sha256").update(first).digest("hex")).toBe(createHash("sha256").update(second).digest("hex"));
  });

  it("registers the generated 8192 by 4096 tint as a managed asset", () => {
    expect(managedAssets).toHaveProperty("atlas.nimbus.region-tint");
    const tint = (managedAssets as Record<string, { objectKey: string; sha256: string; technicalMetadata: { height: number; width: number } }>)["atlas.nimbus.region-tint"]!;
    expect(tint.sha256).toBe("60f541d4eb891d89e7d60f5e0ec399d3833dd4b74069fde19420bbbba9ca97eb");
    expect(tint.objectKey).toBe(`assets/${tint.sha256}.png`);
    expect(tint.technicalMetadata).toMatchObject({ height: 4096, width: 8192 });
  });
});
