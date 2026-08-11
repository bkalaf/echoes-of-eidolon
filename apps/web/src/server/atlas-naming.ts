import type { Prisma, PrismaClient } from "../generated/prisma/client";
import type { CanonicalSettlementSite } from "./atlas";
import { getDatabase } from "./database";

interface ProximityEntity {
  category: string;
  displayName: string | null;
  entityId: string;
  entityType: string;
  nameStatus: string;
  workingName: string;
  [key: string]: unknown;
}

interface SettlementEligibility {
  candidateRank: number;
  distanceKm: number | null;
  anchorDistanceKm: number | null;
  entityId: string;
}

export interface AtlasNamingProximitySupplement {
  nameableEntities: ProximityEntity[];
  bySettlementSiteId: Record<string, { eligibleEntityCount: number; eligibleNameableEntities: SettlementEligibility[]; siteId: string }>;
  sourceSummary: { settlementCandidateCount: number; totalNameableEntityCount: number };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export async function importAtlasNamingProximity(
  supplement: AtlasNamingProximitySupplement,
  sites: readonly CanonicalSettlementSite[],
  database: PrismaClient = getDatabase(),
) {
  if (supplement.sourceSummary.settlementCandidateCount !== 400 || sites.length !== 400 || Object.keys(supplement.bySettlementSiteId).length !== 400) throw new Error("Atlas naming import requires exactly 400 settlement candidates.");
  if (supplement.sourceSummary.totalNameableEntityCount !== 356 || supplement.nameableEntities.length !== 356) throw new Error("Atlas naming import requires exactly 356 nameable entities.");
  if (new Set(supplement.nameableEntities.map((entity) => entity.entityId)).size !== 356) throw new Error("Atlas naming feature identities must be unique.");
  const sitesById = new Map(sites.map((site) => [site.siteId, site]));
  for (const [siteId, entry] of Object.entries(supplement.bySettlementSiteId)) {
    if (entry.siteId !== siteId || !sitesById.has(siteId)) throw new Error(`Atlas naming eligibility references unknown Site ${siteId}.`);
    if (entry.eligibleEntityCount !== entry.eligibleNameableEntities.length) throw new Error(`Atlas naming eligibility count drifted for Site ${siteId}.`);
  }
  return database.$transaction(async (transaction) => {
    for (const site of sites) {
      await transaction.site.update({ where: { siteId: site.siteId }, data: { namingContext: site as Prisma.InputJsonValue } });
    }
    let createdFeatures = 0;
    let unchangedFeatures = 0;
    for (const entity of supplement.nameableEntities) {
      const intended = { context: entity as Prisma.InputJsonValue, featureId: entity.entityId, featureType: entity.category, name: entity.nameStatus === "CANONICAL" ? entity.displayName : null };
      const existing = await transaction.atlasNameableFeature.findUnique({ where: { featureId: entity.entityId } });
      if (!existing) { await transaction.atlasNameableFeature.create({ data: intended }); createdFeatures += 1; }
      else if (existing.featureType === intended.featureType && existing.name === intended.name && canonical(existing.context) === canonical(intended.context)) unchangedFeatures += 1;
      else throw new Error(`Canonical Atlas naming drift detected for ${entity.entityId}.`);
    }
    let createdEligibility = 0;
    let unchangedEligibility = 0;
    for (const [siteId, entry] of Object.entries(supplement.bySettlementSiteId)) {
      for (const eligible of entry.eligibleNameableEntities) {
        const data = { distanceKm: eligible.distanceKm ?? eligible.anchorDistanceKm, featureId: eligible.entityId, rank: eligible.candidateRank, siteId };
        const existing = await transaction.atlasNamingEligibility.findUnique({ where: { siteId_featureId: { featureId: data.featureId, siteId } } });
        if (!existing) { await transaction.atlasNamingEligibility.create({ data }); createdEligibility += 1; }
        else if (existing.rank === data.rank && existing.distanceKm === data.distanceKm) unchangedEligibility += 1;
        else throw new Error(`Canonical Atlas naming eligibility drift detected for ${siteId}/${eligible.entityId}.`);
      }
    }
    return { createdEligibility, createdFeatures, unchangedEligibility, unchangedFeatures };
  });
}
