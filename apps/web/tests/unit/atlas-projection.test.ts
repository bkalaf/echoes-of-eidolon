import { describe, expect, it } from "vitest";

import { globeCartesian, projectGlobePoint, wrapLongitude } from "../../src/domain/atlas-projection";

describe("right-handed Atlas globe projection", () => {
  it("uses +Y north, +X at the prime meridian, and +Z east", () => {
    expect(globeCartesian(0, 0)).toEqual({ x: 1, y: 0, z: 0 });
    expect(globeCartesian(90, 0)).toMatchObject({ x: expect.closeTo(0), y: 1, z: 0 });
    expect(globeCartesian(0, 90)).toMatchObject({ x: expect.closeTo(0), y: 0, z: 1 });
  });

  it("places the prime meridian at center and east longitudes toward +X", () => {
    expect(projectGlobePoint({ centerLatitude: 0, centerLongitude: 0, latitude: 0, longitude: 0, zoom: 1 })).toMatchObject({ visible: true, xPercent: 50, yPercent: 50 });
    expect(projectGlobePoint({ centerLatitude: 0, centerLongitude: 0, latitude: 0, longitude: 45, zoom: 1 }).xPercent).toBeGreaterThan(50);
  });

  it("hides points on the rear hemisphere and wraps longitude deterministically", () => {
    expect(projectGlobePoint({ centerLatitude: 0, centerLongitude: 0, latitude: 0, longitude: 180, zoom: 1 }).visible).toBe(false);
    expect(wrapLongitude(190)).toBe(-170);
    expect(wrapLongitude(-190)).toBe(170);
  });
});
