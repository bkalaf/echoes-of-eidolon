import type { CanonicalSettlementSite } from "./atlas";
import { RegionId, SettlementClassification } from "../generated/prisma/enums";

const classifications = new Set<string>(Object.values(SettlementClassification));
const regions = new Set<string>(Object.values(RegionId));

export interface SiteMirror {
  siteId: string;
  regionId: RegionId;
  candidateType: SettlementClassification;
  latitude: number;
  longitude: number;
}

interface SiteImportTransaction {
  site: {
    findUnique(input: { where: { siteId: string } }): Promise<SiteMirror | null>;
    create(input: { data: SiteMirror }): Promise<unknown>;
  };
}

interface SiteImportDatabase<Transaction extends SiteImportTransaction> {
  $transaction<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result>;
}

function canonicalMirror(site: CanonicalSettlementSite): SiteMirror {
  if (!regions.has(site.regionId)) throw new Error(`Atlas Site ${site.siteId} has an unregistered RegionId.`);
  if (!classifications.has(site.classification)) {
    throw new Error(`Atlas Site ${site.siteId} has an unregistered classification.`);
  }
  if (!Number.isFinite(site.latitude) || site.latitude < -90 || site.latitude > 90) throw new Error(`Atlas Site ${site.siteId} has invalid latitude.`);
  if (!Number.isFinite(site.longitude) || site.longitude < -180 || site.longitude > 180) throw new Error(`Atlas Site ${site.siteId} has invalid longitude.`);
  return {
    siteId: site.siteId,
    regionId: site.regionId as RegionId,
    candidateType: site.classification as SettlementClassification,
    latitude: site.latitude,
    longitude: site.longitude,
  };
}

function sameSite(left: SiteMirror, right: SiteMirror): boolean {
  return left.siteId === right.siteId && left.regionId === right.regionId && left.candidateType === right.candidateType
    && left.latitude === right.latitude && left.longitude === right.longitude;
}

export async function importCanonicalSites<Transaction extends SiteImportTransaction>(
  sites: readonly CanonicalSettlementSite[],
  database: SiteImportDatabase<Transaction>,
): Promise<{ created: number; unchanged: number }> {
  if (sites.length !== 400) throw new Error("Canonical Atlas import requires exactly 400 Sites.");
  if (new Set(sites.map((site) => site.siteId)).size !== sites.length) throw new Error("Canonical Atlas Site identities must be unique.");
  const mirrors = sites.map(canonicalMirror);
  return database.$transaction(async (transaction) => {
    let created = 0;
    let unchanged = 0;
    for (const mirror of mirrors) {
      const existing = await transaction.site.findUnique({ where: { siteId: mirror.siteId } });
      if (!existing) {
        await transaction.site.create({ data: mirror });
        created += 1;
      } else if (sameSite(existing, mirror)) {
        unchanged += 1;
      } else {
        throw new Error(`Canonical Atlas drift detected for Site ${mirror.siteId}.`);
      }
    }
    return { created, unchanged };
  });
}
