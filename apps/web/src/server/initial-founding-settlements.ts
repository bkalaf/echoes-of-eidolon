import { randomUUID } from "node:crypto";

import initialFoundingSettlementData from "../data/initial-founding-settlements.json";
import { SettlementClassification, type RegionId, type WorldKey } from "../generated/prisma/enums";

const expectedWorlds = ["CONCORD", "SCHISM", "RUIN"] as const satisfies readonly WorldKey[];
const classificationValues = new Set<string>(Object.values(SettlementClassification));

interface InitialFoundingSettlement {
  settlementId: string;
  regionId: string;
  regionName: string;
  siteId: string;
  name: string;
  foundingPopulationGroups: string[];
}

interface InitialFoundingSettlementAuthority {
  schemaVersion: string;
  phase: string;
  worlds: WorldKey[];
  expectedPhysicalSettlementCount: number;
  expectedSettlementWorldCount: number;
  settlements: InitialFoundingSettlement[];
  excludedFromInitial: {
    regionId: string;
    regionName: string;
    siteId: string;
    settlementExists: boolean;
    foundingPopulation: null;
    postDjtNames: Record<WorldKey, string>;
  };
}

export const initialFoundingSettlements = initialFoundingSettlementData as unknown as InitialFoundingSettlementAuthority;

interface SiteIdentity {
  siteId: string;
  regionId: RegionId;
  candidateType: SettlementClassification;
}

interface SettlementIdentity {
  settlementId: string;
  siteId: string;
  name: string | null;
  classification: SettlementClassification;
}

interface SettlementWorldIdentity {
  settlementWorldId: string;
  settlementId: string;
  worldKey: WorldKey;
}

export interface InitialFoundingSettlementImportTransaction {
  site: {
    findMany(input: unknown): Promise<SiteIdentity[]>;
  };
  settlement: {
    findMany(input: unknown): Promise<SettlementIdentity[]>;
    create(input: { data: SettlementIdentity }): Promise<unknown>;
  };
  settlementWorld: {
    findMany(input: unknown): Promise<SettlementWorldIdentity[]>;
    create(input: { data: SettlementWorldIdentity }): Promise<unknown>;
  };
}

export interface InitialFoundingSettlementImportDatabase<Transaction extends InitialFoundingSettlementImportTransaction = InitialFoundingSettlementImportTransaction> {
  $transaction<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result>;
}

export interface InitialFoundingSettlementImportResult {
  mode: "verify" | "apply";
  settlements: {
    created: number;
    unchanged: number;
    wouldCreate: number;
    preservedIdentities: number;
  };
  settlementWorlds: {
    created: number;
    unchanged: number;
    wouldCreate: number;
  };
}

function assertAuthority(): void {
  const authority = initialFoundingSettlements;
  if (authority.schemaVersion !== "eidolon-release-0.3.0-initial-founding-settlements-v1" || authority.phase !== "INITIAL") {
    throw new Error("INITIAL founding Settlement authority identity is invalid.");
  }
  if (authority.expectedPhysicalSettlementCount !== 24 || authority.settlements.length !== 24) {
    throw new Error("INITIAL founding Settlement authority requires exactly 24 physical Settlements.");
  }
  if (authority.expectedSettlementWorldCount !== 72 || authority.expectedSettlementWorldCount !== authority.settlements.length * expectedWorlds.length) {
    throw new Error("INITIAL founding Settlement authority requires exactly 72 SettlementWorld identities.");
  }
  if (authority.worlds.length !== expectedWorlds.length || authority.worlds.some((world, index) => world !== expectedWorlds[index])) {
    throw new Error("INITIAL founding Settlement authority must use CONCORD, SCHISM, and RUIN in canonical order.");
  }
  if (new Set(authority.settlements.map(({ settlementId }) => settlementId)).size !== authority.settlements.length
    || new Set(authority.settlements.map(({ siteId }) => siteId)).size !== authority.settlements.length) {
    throw new Error("INITIAL founding Settlement and Site identities must be unique.");
  }
  for (const settlement of authority.settlements) {
    if (!/^SET_[A-Z0-9_]+$/.test(settlement.settlementId)) throw new Error("Invalid canonical Settlement identity " + settlement.settlementId + ".");
    if (!/^SITE-[0-9]{4}$/.test(settlement.siteId)) throw new Error("Invalid canonical Site identity " + settlement.siteId + ".");
    if (settlement.regionId === "R10" || settlement.siteId === "SITE-0243") {
      throw new Error("R10 / SITE-0243 must not have an INITIAL Settlement.");
    }
    if (settlement.foundingPopulationGroups.length === 0) {
      throw new Error("Founding population group authority is missing for " + settlement.settlementId + ".");
    }
  }
  const excluded = authority.excludedFromInitial;
  if (excluded.regionId !== "R10" || excluded.siteId !== "SITE-0243" || excluded.settlementExists !== false
    || excluded.foundingPopulation !== null || excluded.postDjtNames.CONCORD !== "Ashgarden"
    || excluded.postDjtNames.SCHISM !== "Second Song" || excluded.postDjtNames.RUIN !== "Last Well") {
    throw new Error("R10 INITIAL exclusion authority is invalid.");
  }
}

function sameSettlement(existing: SettlementIdentity, canonical: InitialFoundingSettlement, site: SiteIdentity): boolean {
  return existing.siteId === canonical.siteId && existing.name === canonical.name && existing.classification === site.candidateType;
}

export async function importInitialFoundingSettlements<Transaction extends InitialFoundingSettlementImportTransaction>(
  database: InitialFoundingSettlementImportDatabase<Transaction>,
  options: { mode?: "verify" | "apply"; settlementWorldIdFactory?: () => string } = {},
): Promise<InitialFoundingSettlementImportResult> {
  assertAuthority();
  const mode = options.mode ?? "verify";
  const settlementWorldIdFactory = options.settlementWorldIdFactory ?? randomUUID;
  const canonicalSettlementIds = initialFoundingSettlements.settlements.map(({ settlementId }) => settlementId);
  const canonicalSiteIds = initialFoundingSettlements.settlements.map(({ siteId }) => siteId);

  return database.$transaction(async (transaction) => {
    const siteRows = await transaction.site.findMany({
      where: { siteId: { in: canonicalSiteIds } },
      select: { candidateType: true, regionId: true, siteId: true },
    });
    const sitesById = new Map(siteRows.map((site) => [site.siteId, site]));
    for (const canonical of initialFoundingSettlements.settlements) {
      const site = sitesById.get(canonical.siteId);
      if (!site) throw new Error("Missing canonical Site " + canonical.siteId + " for INITIAL Settlement " + canonical.settlementId + ".");
      if (site.regionId !== canonical.regionId) {
        throw new Error("Canonical Site region conflict for " + canonical.siteId + ".");
      }
      if (!classificationValues.has(site.candidateType)) {
        throw new Error("Canonical Site classification is invalid for " + canonical.siteId + ".");
      }
    }

    const existingSettlements = await transaction.settlement.findMany({
      where: {
        OR: [
          { settlementId: { in: canonicalSettlementIds } },
          { siteId: { in: canonicalSiteIds } },
        ],
      },
      select: { classification: true, name: true, settlementId: true, siteId: true },
    });
    const existingById = new Map(existingSettlements.map((settlement) => [settlement.settlementId, settlement]));
    const existingBySite = new Map(existingSettlements.map((settlement) => [settlement.siteId, settlement]));
    const resolvedSettlementIds = new Map<string, string>();
    const pendingSettlements: SettlementIdentity[] = [];
    let unchangedSettlements = 0;
    let preservedIdentities = 0;

    for (const canonical of initialFoundingSettlements.settlements) {
      const site = sitesById.get(canonical.siteId)!;
      const byId = existingById.get(canonical.settlementId);
      const bySite = existingBySite.get(canonical.siteId);
      if (byId && bySite && byId.settlementId !== bySite.settlementId) {
        throw new Error("Canonical Settlement conflict: ID and Site resolve to different rows for " + canonical.settlementId + ".");
      }
      const existing = byId ?? bySite;
      if (existing) {
        if (!sameSettlement(existing, canonical, site)) {
          throw new Error("Canonical Settlement conflict for " + canonical.settlementId + " at " + canonical.siteId + ".");
        }
        resolvedSettlementIds.set(canonical.settlementId, existing.settlementId);
        unchangedSettlements += 1;
        if (existing.settlementId !== canonical.settlementId) preservedIdentities += 1;
      } else {
        resolvedSettlementIds.set(canonical.settlementId, canonical.settlementId);
        pendingSettlements.push({
          settlementId: canonical.settlementId,
          siteId: canonical.siteId,
          name: canonical.name,
          classification: site.candidateType,
        });
      }
    }

    const resolvedIds = [...resolvedSettlementIds.values()];
    const existingWorlds = await transaction.settlementWorld.findMany({
      where: { settlementId: { in: resolvedIds }, worldKey: { in: [...expectedWorlds] } },
      select: { settlementId: true, settlementWorldId: true, worldKey: true },
    });
    const worldsByOwner = new Map<string, SettlementWorldIdentity>();
    for (const world of existingWorlds) {
      const key = world.settlementId + ":" + world.worldKey;
      if (worldsByOwner.has(key)) throw new Error("Duplicate INITIAL SettlementWorld identity for " + key + ".");
      worldsByOwner.set(key, world);
    }
    const pendingWorlds: Omit<SettlementWorldIdentity, "settlementWorldId">[] = [];
    let unchangedWorlds = 0;
    for (const canonical of initialFoundingSettlements.settlements) {
      const settlementId = resolvedSettlementIds.get(canonical.settlementId)!;
      for (const worldKey of expectedWorlds) {
        if (worldsByOwner.has(settlementId + ":" + worldKey)) unchangedWorlds += 1;
        else pendingWorlds.push({ settlementId, worldKey });
      }
    }
    if (unchangedWorlds + pendingWorlds.length !== initialFoundingSettlements.expectedSettlementWorldCount) {
      throw new Error("INITIAL SettlementWorld audit did not resolve exactly 72 identities.");
    }

    if (mode === "verify") {
      return {
        mode,
        settlements: { created: 0, unchanged: unchangedSettlements, wouldCreate: pendingSettlements.length, preservedIdentities },
        settlementWorlds: { created: 0, unchanged: unchangedWorlds, wouldCreate: pendingWorlds.length },
      };
    }
    for (const settlement of pendingSettlements) await transaction.settlement.create({ data: settlement });
    for (const world of pendingWorlds) {
      await transaction.settlementWorld.create({ data: { ...world, settlementWorldId: settlementWorldIdFactory() } });
    }
    return {
      mode,
      settlements: { created: pendingSettlements.length, unchanged: unchangedSettlements, wouldCreate: 0, preservedIdentities },
      settlementWorlds: { created: pendingWorlds.length, unchanged: unchangedWorlds, wouldCreate: 0 },
    };
  });
}
