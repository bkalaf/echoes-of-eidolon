import { assertAtlasRegionPresentation, atlasRegionColor } from "../content/atlas-region-presentation";
import { publicAtlasGeographicPointCount, type AtlasGeographicPoint } from "../data/atlas-geographic-points";
import type { LatticeId, RegionId } from "../generated/prisma/enums";
import type { AtlasTopology } from "./atlas-topology";
import { validateAtlasTopology } from "./atlas-topology";
import type { CanonicalAtlasContinent, CanonicalAtlasRegion, CanonicalFoundingCitySite } from "../server/atlas";

export interface PublicAtlasFoundingCity {
  latitude: number;
  longitude: number;
  name: string;
  regionColor: string;
  regionId: RegionId;
  siteId: string;
}

export interface PublicAtlasRegion {
  color: string;
  name: string;
  regionId: RegionId;
}

export interface PublicAtlasContinent {
  latitude: number;
  longitude: number;
  name: string;
}

export type PublicAtlasGeographicPoint = AtlasGeographicPoint;

export interface PublicAtlasProjection {
  connections: Array<{ atlasConnectionId: string; fromLatticeId: LatticeId; toLatticeId: LatticeId }>;
  continents: PublicAtlasContinent[];
  foundingCities: PublicAtlasFoundingCity[];
  geographicPoints: PublicAtlasGeographicPoint[];
  regionMappings: Array<{ latticeId: LatticeId; regionId: RegionId }>;
  regions: PublicAtlasRegion[];
}

interface PublicAtlasAuthority {
  continents: readonly CanonicalAtlasContinent[];
  foundingCitySites: readonly CanonicalFoundingCitySite[];
  geographicPoints: readonly AtlasGeographicPoint[];
  regions: readonly CanonicalAtlasRegion[];
}

function authorityFailure(detail: string): never {
  throw new Error(`Public Atlas founding city authority mismatch: ${detail}`);
}

function validCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export function projectPublicAtlas(authority: PublicAtlasAuthority, topologyInput: AtlasTopology): PublicAtlasProjection {
  assertAtlasRegionPresentation();
  if (authority.regions.length !== 25) authorityFailure("physical Region count");
  const regionsById = new Map<RegionId, CanonicalAtlasRegion>();
  const regions = [...authority.regions]
    .sort((left, right) => left.regionId.localeCompare(right.regionId))
    .map((region) => {
      if (regionsById.has(region.regionId)) authorityFailure(`duplicate Region ${region.regionId}`);
      if (!region.displayName?.trim()) authorityFailure(`missing Region name ${region.regionId}`);
      const name = region.displayName.trim();
      const color = atlasRegionColor(region.regionId);
      regionsById.set(region.regionId, region);
      return { color, name, regionId: region.regionId };
    });
  if (regionsById.size !== 25 || !regionsById.has("R10")) authorityFailure("physical Region identities");

  const originalInitialCities = authority.foundingCitySites.filter(({ existsAtInitialFounding, isOriginalFoundingCity }) => existsAtInitialFounding && isOriginalFoundingCity);
  if (originalInitialCities.length !== 24) authorityFailure(`expected 24 cities, received ${originalInitialCities.length}`);
  const siteIds = new Set<string>();
  const cityRegionIds = new Set<RegionId>();
  const foundingCities = [...originalInitialCities]
    .sort((left, right) => left.regionId.localeCompare(right.regionId))
    .map((site) => {
      const name = site.cityDisplayName.trim();
      if (!name) authorityFailure(`blank city name for ${site.siteId}`);
      if (site.regionId === "R10") authorityFailure("R10 must not contain an initial founding city");
      if (!regionsById.has(site.regionId)) authorityFailure(`missing Region ${site.regionId} for ${site.siteId}`);
      if (siteIds.has(site.siteId)) authorityFailure(`duplicate Site ${site.siteId}`);
      if (cityRegionIds.has(site.regionId)) authorityFailure(`duplicate founding Region ${site.regionId}`);
      if (!validCoordinates(site.latitude, site.longitude)) authorityFailure(`invalid coordinates for ${site.siteId}`);
      siteIds.add(site.siteId);
      cityRegionIds.add(site.regionId);
      return {
        latitude: site.latitude,
        longitude: site.longitude,
        name,
        regionColor: atlasRegionColor(site.regionId),
        regionId: site.regionId,
        siteId: site.siteId,
      };
    });
  if (siteIds.size !== 24 || cityRegionIds.size !== 24) authorityFailure("founding city uniqueness");

  if (authority.continents.length !== 3) throw new Error(`Public Atlas continent authority mismatch: expected 3 labels, received ${authority.continents.length}.`);
  const continentNames = new Set<string>();
  const continents = [...authority.continents].sort((left, right) => left.continentName.localeCompare(right.continentName)).map((continent) => {
    const name = continent.continentName.trim();
    if (!name || continentNames.has(name) || !validCoordinates(continent.labelLatitude, continent.labelLongitude)) {
      throw new Error(`Public Atlas continent authority mismatch: ${name || "blank continent"}.`);
    }
    continentNames.add(name);
    return { latitude: continent.labelLatitude, longitude: continent.labelLongitude, name };
  });

  if (authority.geographicPoints.length !== publicAtlasGeographicPointCount) throw new Error(`Public Atlas geographic authority mismatch: expected ${publicAtlasGeographicPointCount} labels, received ${authority.geographicPoints.length}.`);
  const geographicIds = new Set<string>();
  const geographicPoints = [...authority.geographicPoints].sort((left, right) => left.poiId.localeCompare(right.poiId)).map((point) => {
    if (!/^POI-\d{3}$/.test(point.poiId) || geographicIds.has(point.poiId)) throw new Error(`Public Atlas duplicate geographic identity: ${point.poiId}.`);
    if (!point.name.trim() || !point.category.trim() || !regionsById.has(point.regionId) || !validCoordinates(point.latitude, point.longitude)) {
      throw new Error(`Public Atlas geographic authority mismatch: ${point.poiId}.`);
    }
    geographicIds.add(point.poiId);
    return { category: point.category, latitude: point.latitude, longitude: point.longitude, name: point.name.trim(), poiId: point.poiId, regionId: point.regionId };
  });

  const topology = validateAtlasTopology(topologyInput);
  return {
    connections: topology.connections.map(({ atlasConnectionId, fromLatticeId, toLatticeId }) => ({ atlasConnectionId, fromLatticeId, toLatticeId })),
    continents,
    foundingCities,
    geographicPoints,
    regionMappings: topology.mappings.map(({ latticeId, regionId }) => ({ latticeId, regionId })),
    regions,
  };
}
