import { describe, expect, it } from "vitest";

import { atlasGeographicPoints, atlasGeographicPointsSource } from "../../src/data/atlas-geographic-points";

describe("Atlas geographic labels", () => {
  it("materializes all 92 simulator-authored geographic features with safe public fields", () => {
    expect(atlasGeographicPoints).toHaveLength(92);
    expect(new Set(atlasGeographicPoints.map(({ poiId }) => poiId))).toHaveProperty("size", 92);
    expect(atlasGeographicPoints.every(({ latitude, longitude, name }) => name.trim().length > 0
      && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
      && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180)).toBe(true);
    expect(atlasGeographicPointsSource).toMatchObject({
      repository: "bkalaf/echoes-simulator",
      sourceSha256: "2ae815f7edd45a7b8632f5a9df60704df682c3b3b1a11d8f2db5c2fe4d77dfaf",
    });
    expect(Object.keys(atlasGeographicPoints[0]!).sort()).toEqual(["category", "latitude", "longitude", "name", "poiId", "regionId"]);
  });

  it("includes named oceans, seas, mountain ranges, peaks, forests, and deserts", () => {
    const byCategory = new Map<string, string[]>(Array.from(new Set(atlasGeographicPoints.map(({ category }) => category))).map((category) => [
      category,
      atlasGeographicPoints.filter((point) => point.category === category).map(({ name }) => name),
    ]));
    expect(byCategory.get("OCEAN")).toEqual(["Northern Ocean", "Southern Ocean"]);
    expect(byCategory.get("SEA")).toEqual(["Meridian Sea", "Southern Passage Sea"]);
    expect(byCategory.get("MOUNTAIN_RANGE")).toHaveLength(4);
    expect(byCategory.get("PEAK")).toHaveLength(12);
    expect(byCategory.get("FOREST")).toHaveLength(4);
    expect(byCategory.get("DESERT")).toHaveLength(4);
  });
});
