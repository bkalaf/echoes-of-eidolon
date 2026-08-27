import raw from "./atlas-geographic-points.json";
import { atlasRegionPalette } from "../content/atlas-region-presentation";
import type { RegionId } from "../generated/prisma/enums";

export interface AtlasGeographicPoint {
  category: string;
  latitude: number;
  longitude: number;
  name: string;
  poiId: string;
  regionId: RegionId;
}

function validCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

if (raw.records.length !== 92) throw new Error(`Atlas geographic label authority expected 92 records, received ${raw.records.length}.`);
const seen = new Set<string>();
export const atlasGeographicPoints = raw.records.map((record): AtlasGeographicPoint => {
  if (!/^POI-\d{3}$/.test(record.poiId) || seen.has(record.poiId)) throw new Error(`Atlas geographic label has a missing or duplicate ID: ${record.poiId}.`);
  if (!record.name.trim() || !record.category.trim()) throw new Error(`Atlas geographic label ${record.poiId} has a blank name or category.`);
  if (!(record.regionId in atlasRegionPalette)) throw new Error(`Atlas geographic label ${record.poiId} has an unknown Region.`);
  if (!validCoordinate(record.latitude, record.longitude)) throw new Error(`Atlas geographic label ${record.poiId} has invalid coordinates.`);
  seen.add(record.poiId);
  return { ...record, regionId: record.regionId as RegionId };
});

export const atlasGeographicPointsSource = raw.source;
