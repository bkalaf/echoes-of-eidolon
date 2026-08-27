import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createAtlasRegionOverlaySvg, validateAtlasRegionGeoJson } from "../../src/domain/atlas-region-overlay";
import { atlasRegionPalette } from "../../src/content/atlas-region-presentation";
import managedAssets from "../../src/data/managed-assets.json";

const exactPalette = {
  R01: "#00796B", R02: "#E66A00", R03: "#A67700", R04: "#1565C0", R05: "#C62828",
  R06: "#0077A0", R07: "#2E7D32", R08: "#6A1B9A", R09: "#3949AB", R10: "#E66A00",
  R11: "#C62828", R12: "#00796B", R13: "#0077A0", R14: "#A67700", R15: "#2E7D32",
  R16: "#6A1B9A", R17: "#1565C0", R18: "#6A1B9A", R19: "#E66A00", R20: "#2E7D32",
  R21: "#AD1457", R22: "#A67700", R23: "#C62828", R24: "#00796B", R25: "#0077A0",
} as const;

describe("Atlas Region presentation", () => {
  it("uses the exact V4 palette for all 25 Regions", () => {
    expect(atlasRegionPalette).toEqual(exactPalette);
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
    expect(first).toContain('fill="#E66A00"');
    expect(first).toContain('fill-rule="evenodd"');
    expect(createHash("sha256").update(first).digest("hex")).toBe(createHash("sha256").update(second).digest("hex"));
  });

  it("registers the generated 8192 by 4096 tint as a managed asset", () => {
    expect(managedAssets).toHaveProperty("atlas.nimbus.region-tint");
    const tint = (managedAssets as Record<string, { objectKey: string; sha256: string; technicalMetadata: { height: number; width: number } }>)["atlas.nimbus.region-tint"]!;
    expect(tint.sha256).toBe("b68590ab914433592d963951a7d413351f41bc21d4c6bdf814335a7128b6077b");
    expect(tint.objectKey).toBe(`assets/${tint.sha256}.png`);
    expect(tint.technicalMetadata).toMatchObject({ height: 4096, width: 8192 });
  });
});
