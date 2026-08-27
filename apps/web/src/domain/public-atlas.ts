import { atlasRegionColor } from "../content/atlas-region-presentation";
import type { LatticeId, RegionId } from "../generated/prisma/enums";
import type { AtlasTopology } from "./atlas-topology";
import { validateAtlasTopology } from "./atlas-topology";
import type { CanonicalAtlasRegion, CanonicalFoundingCitySite } from "../server/atlas";

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

export interface PublicAtlasProjection {
  connections: Array<{ atlasConnectionId: string; fromLatticeId: LatticeId; toLatticeId: LatticeId }>;
  foundingCities: PublicAtlasFoundingCity[];
  regionMappings: Array<{ latticeId: LatticeId; regionId: RegionId }>;
  regions: PublicAtlasRegion[];
}

interface PublicAtlasAuthority {
  foundingCitySites: readonly CanonicalFoundingCitySite[];
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

  const topology = validateAtlasTopology(topologyInput);
  return {
    connections: topology.connections.map(({ atlasConnectionId, fromLatticeId, toLatticeId }) => ({ atlasConnectionId, fromLatticeId, toLatticeId })),
    foundingCities,
    regionMappings: topology.mappings.map(({ latticeId, regionId }) => ({ latticeId, regionId })),
    regions,
  };
}
