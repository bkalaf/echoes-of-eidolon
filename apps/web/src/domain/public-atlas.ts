import type { AtlasCatalogProjection } from "../server/atlas";
import type { RegionId } from "../generated/prisma/enums";

export interface PublicAtlasProjection {
  connections: Array<{ atlasConnectionId: string; fromLatticeId: string; toLatticeId: string }>;
  pointsOfInterest: Array<{ category: string; displayName: string | null; latticeId: string; latitude: number; longitude: number; poiId: string; regionId: string; workingLabel: string }>;
  regionMappings: Array<{ latticeId: string; regionId: string }>;
}

export interface PublicAtlasSettlement {
  settlement: { classification: string; name: string | null; settlementId: string; site: { latitude: number; longitude: number; regionId: RegionId; siteId: string } };
}

export function projectPublicAtlas(atlas: AtlasCatalogProjection, ruinSettlements: readonly PublicAtlasSettlement[] = []): PublicAtlasProjection {
  const latticeByRegion = new Map(atlas.regionMappings.map(({ latticeId, regionId }) => [regionId, latticeId]));
  return {
    connections: atlas.connections.map(({ atlasConnectionId, fromLatticeId, toLatticeId }) => ({ atlasConnectionId, fromLatticeId, toLatticeId })),
    pointsOfInterest: [
      ...atlas.pointsOfInterest.map(({ category, displayName, latticeId, latitude, longitude, poiId, regionId, workingLabel }) => ({ category, displayName, latticeId, latitude, longitude, poiId, regionId, workingLabel })),
      ...ruinSettlements.map(({ settlement }) => ({ category: settlement.classification, displayName: settlement.name, latticeId: latticeByRegion.get(settlement.site.regionId) ?? "", latitude: settlement.site.latitude, longitude: settlement.site.longitude, poiId: `SETTLEMENT:${settlement.settlementId}`, regionId: settlement.site.regionId, workingLabel: settlement.name ?? `Settlement ${settlement.site.siteId}` })),
    ],
    regionMappings: atlas.regionMappings.map(({ latticeId, regionId }) => ({ latticeId, regionId })),
  };
}
