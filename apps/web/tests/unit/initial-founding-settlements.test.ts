import { describe, expect, it, vi } from "vitest";

import {
  importInitialFoundingSettlements,
  initialFoundingSettlements,
  type InitialFoundingSettlementImportDatabase,
} from "../../src/server/initial-founding-settlements";

type SiteRow = { siteId: string; regionId: string; candidateType: "HAMLET" | "VILLAGE" | "TOWN" | "CITY" | "METROPOLIS" };
type SettlementRow = { settlementId: string; siteId: string; name: string | null; classification: SiteRow["candidateType"] };
type WorldRow = { settlementWorldId: string; settlementId: string; worldKey: "CONCORD" | "SCHISM" | "RUIN" };

function database(options: {
  missingSiteId?: string;
  settlements?: SettlementRow[];
  worlds?: WorldRow[];
} = {}) {
  const sites = new Map<string, SiteRow>(
    initialFoundingSettlements.settlements
      .filter(({ siteId }) => siteId !== options.missingSiteId)
      .map(({ regionId, siteId }, index) => [
        siteId,
        {
          siteId,
          regionId,
          candidateType: (["METROPOLIS", "CITY", "TOWN", "VILLAGE", "HAMLET"] as const)[index % 5]!,
        },
      ]),
  );
  const settlements = new Map((options.settlements ?? []).map((row) => [row.settlementId, row]));
  const worlds = new Map((options.worlds ?? []).map((row) => [row.settlementId + ":" + row.worldKey, row]));
  const settlementCreate = vi.fn(async ({ data }: { data: SettlementRow }) => {
    settlements.set(data.settlementId, data);
    return data;
  });
  const worldCreate = vi.fn(async ({ data }: { data: WorldRow }) => {
    worlds.set(data.settlementId + ":" + data.worldKey, data);
    return data;
  });
  const transaction = {
    site: {
      findMany: vi.fn(async () => [...sites.values()]),
    },
    settlement: {
      findMany: vi.fn(async () => [...settlements.values()]),
      create: settlementCreate,
    },
    settlementWorld: {
      findMany: vi.fn(async () => [...worlds.values()]),
      create: worldCreate,
    },
  };
  return {
    database: {
      $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)),
    } as InitialFoundingSettlementImportDatabase<typeof transaction>,
    sites,
    settlementCreate,
    settlements,
    worldCreate,
    worlds,
  };
}

describe("Release 0.3.0 INITIAL founding Settlement import", () => {
  it("locks exactly 24 physical Settlements and 72 world identities while excluding R10", () => {
    expect(initialFoundingSettlements.schemaVersion).toBe("eidolon-release-0.3.0-initial-founding-settlements-v1");
    expect(initialFoundingSettlements.phase).toBe("INITIAL");
    expect(initialFoundingSettlements.worlds).toEqual(["CONCORD", "SCHISM", "RUIN"]);
    expect(initialFoundingSettlements.settlements).toHaveLength(24);
    expect(new Set(initialFoundingSettlements.settlements.map(({ settlementId }) => settlementId)).size).toBe(24);
    expect(new Set(initialFoundingSettlements.settlements.map(({ siteId }) => siteId)).size).toBe(24);
    expect(initialFoundingSettlements.settlements).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ regionId: "R10" }), expect.objectContaining({ siteId: "SITE-0243" })]),
    );
    expect(initialFoundingSettlements.expectedSettlementWorldCount).toBe(72);
  });

  it("is verify-only by default and reports every pending insert without writing", async () => {
    const fixture = database();
    await expect(importInitialFoundingSettlements(fixture.database)).resolves.toMatchObject({
      mode: "verify",
      settlements: { created: 0, unchanged: 0, wouldCreate: 24 },
      settlementWorlds: { created: 0, unchanged: 0, wouldCreate: 72 },
    });
    expect(fixture.database.$transaction).toHaveBeenCalledOnce();
    expect(fixture.settlementCreate).not.toHaveBeenCalled();
    expect(fixture.worldCreate).not.toHaveBeenCalled();
  });

  it("applies all identities in one transaction using each Site candidate classification", async () => {
    const fixture = database();
    await expect(importInitialFoundingSettlements(fixture.database, { mode: "apply" })).resolves.toMatchObject({
      mode: "apply",
      settlements: { created: 24, unchanged: 0, wouldCreate: 0 },
      settlementWorlds: { created: 72, unchanged: 0, wouldCreate: 0 },
    });
    expect(fixture.database.$transaction).toHaveBeenCalledOnce();
    expect(fixture.settlementCreate).toHaveBeenCalledTimes(24);
    expect(fixture.worldCreate).toHaveBeenCalledTimes(72);
    for (const settlement of fixture.settlements.values()) {
      expect(settlement.classification).toBe(fixture.sites.get(settlement.siteId)?.candidateType);
    }
    expect([...fixture.worlds.values()]).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ settlementId: expect.stringContaining("R10") })]),
    );
  });

  it("changes zero rows on an exact second apply", async () => {
    const fixture = database();
    await importInitialFoundingSettlements(fixture.database, { mode: "apply" });
    fixture.settlementCreate.mockClear();
    fixture.worldCreate.mockClear();
    await expect(importInitialFoundingSettlements(fixture.database, { mode: "apply" })).resolves.toMatchObject({
      settlements: { created: 0, unchanged: 24, wouldCreate: 0 },
      settlementWorlds: { created: 0, unchanged: 72, wouldCreate: 0 },
    });
    expect(fixture.settlementCreate).not.toHaveBeenCalled();
    expect(fixture.worldCreate).not.toHaveBeenCalled();
  });

  it("fails closed before writes when a Site is missing or a persisted identity conflicts", async () => {
    const missing = database({ missingSiteId: "SITE-0081" });
    await expect(importInitialFoundingSettlements(missing.database, { mode: "apply" })).rejects.toThrow(/missing canonical Site SITE-0081/i);
    expect(missing.settlementCreate).not.toHaveBeenCalled();
    expect(missing.worldCreate).not.toHaveBeenCalled();

    const canonical = initialFoundingSettlements.settlements[0]!;
    const conflict = database({
      settlements: [{
        settlementId: canonical.settlementId,
        siteId: canonical.siteId,
        name: "Conflicting Name",
        classification: "METROPOLIS",
      }],
    });
    await expect(importInitialFoundingSettlements(conflict.database, { mode: "apply" })).rejects.toThrow(/canonical Settlement conflict/i);
    expect(conflict.settlementCreate).not.toHaveBeenCalled();
    expect(conflict.worldCreate).not.toHaveBeenCalled();
  });

  it("preserves a compatible persisted Settlement identity for the same canonical Site", async () => {
    const canonical = initialFoundingSettlements.settlements[0]!;
    const fixture = database({
      settlements: [{
        settlementId: "SET_PREEXISTING_AUTHORIZED_ANSERIS",
        siteId: canonical.siteId,
        name: canonical.name,
        classification: "METROPOLIS",
      }],
    });
    await expect(importInitialFoundingSettlements(fixture.database, { mode: "apply" })).resolves.toMatchObject({
      settlements: { created: 23, preservedIdentities: 1, unchanged: 1 },
      settlementWorlds: { created: 72 },
    });
    expect(fixture.settlements.has(canonical.settlementId)).toBe(false);
    expect([...fixture.worlds.values()].filter(({ settlementId }) => settlementId === "SET_PREEXISTING_AUTHORIZED_ANSERIS")).toHaveLength(3);
  });
});
