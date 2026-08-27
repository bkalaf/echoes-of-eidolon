import { atlasRegionPalette } from "../content/atlas-region-presentation";
import type { RegionId } from "../generated/prisma/enums";

type Position = readonly [number, number];
type PolygonCoordinates = readonly (readonly Position[])[];

interface AtlasRegionGeometry {
  coordinates: PolygonCoordinates | readonly PolygonCoordinates[];
  type: "MultiPolygon" | "Polygon";
}

interface AtlasRegionFeature {
  geometry: AtlasRegionGeometry;
  properties: { regionId: RegionId };
  type: "Feature";
}

export interface AtlasRegionGeoJson {
  features: AtlasRegionFeature[];
  type: "FeatureCollection";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertPosition(value: unknown): asserts value is Position {
  if (!Array.isArray(value) || value.length < 2 || typeof value[0] !== "number" || typeof value[1] !== "number"
    || !Number.isFinite(value[0]) || !Number.isFinite(value[1])
    || value[0] < -180 || value[0] > 180 || value[1] < -90 || value[1] > 90) {
    throw new Error("Atlas Region geography contains an invalid EPSG:4326 position.");
  }
}

function assertRing(value: unknown): asserts value is readonly Position[] {
  if (!Array.isArray(value) || value.length < 4) throw new Error("Atlas Region geography contains an invalid polygon ring.");
  value.forEach(assertPosition);
  const first = value[0]!;
  const last = value.at(-1)!;
  if (first[0] !== last[0] || first[1] !== last[1]) throw new Error("Atlas Region polygon rings must be closed.");
}

function assertPolygon(value: unknown): asserts value is PolygonCoordinates {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Atlas Region geography contains an empty polygon.");
  value.forEach(assertRing);
}

export function validateAtlasRegionGeoJson(value: unknown): AtlasRegionGeoJson {
  if (!isRecord(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features) || value.features.length !== 25) {
    throw new Error("Atlas Region geography must contain exactly 25 features.");
  }
  const seen = new Set<string>();
  const features = value.features.map((featureValue) => {
    if (!isRecord(featureValue) || featureValue.type !== "Feature" || !isRecord(featureValue.properties) || !isRecord(featureValue.geometry)) {
      throw new Error("Atlas Region geography contains an invalid feature.");
    }
    const regionId = featureValue.properties.regionId;
    if (typeof regionId !== "string" || !(regionId in atlasRegionPalette) || seen.has(regionId)) {
      throw new Error("Atlas Region geography contains a missing, duplicate, or unknown Region ID.");
    }
    seen.add(regionId);
    const geometryType = featureValue.geometry.type;
    const coordinates = featureValue.geometry.coordinates;
    if (geometryType === "Polygon") assertPolygon(coordinates);
    else if (geometryType === "MultiPolygon") {
      if (!Array.isArray(coordinates) || coordinates.length === 0) throw new Error("Atlas Region geography contains an empty MultiPolygon.");
      coordinates.forEach(assertPolygon);
    } else throw new Error("Atlas Region geography supports only Polygon and MultiPolygon features.");
    return {
      geometry: { coordinates, type: geometryType },
      properties: { regionId: regionId as RegionId },
      type: "Feature" as const,
    } as AtlasRegionFeature;
  });
  if (Object.keys(atlasRegionPalette).some((regionId) => !seen.has(regionId))) throw new Error("Atlas Region geography is incomplete.");
  return { features, type: "FeatureCollection" };
}

function coordinate(value: number): string {
  return String(Number(value.toFixed(3)));
}

function pathForRing(ring: readonly Position[], width: number, height: number): string {
  return ring.map(([longitude, latitude], index) => {
    const x = (longitude + 180) / 360 * width;
    const y = (90 - latitude) / 180 * height;
    return `${index === 0 ? "M" : "L"}${coordinate(x)} ${coordinate(y)}`;
  }).join(" ") + " Z";
}

export function createAtlasRegionOverlaySvg(geography: AtlasRegionGeoJson, width: number, height: number): string {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error("Atlas Region overlay dimensions must be positive integers.");
  const paths = [...geography.features]
    .sort((left, right) => left.properties.regionId.localeCompare(right.properties.regionId))
    .map(({ geometry, properties }) => {
      const polygons = geometry.type === "Polygon"
        ? [geometry.coordinates as PolygonCoordinates]
        : geometry.coordinates as readonly PolygonCoordinates[];
      const path = polygons.flatMap((polygon) => polygon.map((ring) => pathForRing(ring, width, height))).join(" ");
      return `<path data-region-id="${properties.regionId}" d="${path}" fill="${atlasRegionPalette[properties.regionId]}" fill-rule="evenodd"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths}</svg>`;
}
