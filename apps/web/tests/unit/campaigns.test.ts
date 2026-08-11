import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { defaultDisjointTrilogy } from "../../src/domain/campaign-planner";
import { saveDisjointTrilogy, saveLinkedCampaignPlacements } from "../../src/server/campaigns";

const linkedPlacements = [
  { bookNumbers: [1, 18], name: "CONCORD Campaign", objectId: "A", objectType: "COMPANION" as const, worldKey: "CONCORD" as const },
  { bookNumbers: [1, 18], name: "CONCORD Campaign", objectId: "transition-1", objectType: "TRANSITION" as const, worldKey: "CONCORD" as const },
  { bookNumbers: [1, 18], name: "CONCORD Campaign", objectId: "deja-1", objectType: "DEJA_VU" as const, worldKey: "CONCORD" as const },
];

function linkedDatabase(options: { missingDeja?: boolean } = {}) {
  const committed: unknown[] = [];
  const transaction = vi.fn(async (work: (value: Record<string, unknown>) => Promise<unknown>) => {
    const staged: unknown[] = [];
    const client = {
      campaign: { upsert: vi.fn().mockResolvedValue({ campaignId: "campaign-1" }) },
      campaignPlacement: {
        aggregate: vi.fn().mockResolvedValue({ _max: { ordinal: null } }),
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(async (input) => { staged.push(input); return input; }),
      },
      companion: { findUnique: vi.fn().mockResolvedValue({ companionKey: "A" }) },
      interlude: { findFirst: vi.fn().mockResolvedValue(options.missingDeja ? null : { interludeId: "deja-1" }) },
      transition: { findUnique: vi.fn().mockResolvedValue({ transitionId: "transition-1" }) },
    };
    const result = await work(client);
    committed.push(...staged);
    return result;
  });
  return { committed, database: { $transaction: transaction } as unknown as PrismaClient, transaction };
}

describe("campaign transaction service", () => {
  it("commits one complete linked group as one serializable transaction", async () => {
    const { committed, database, transaction } = linkedDatabase();
    await saveLinkedCampaignPlacements({ placements: linkedPlacements }, database);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(committed).toHaveLength(3);
  });

  it("rolls back the entire linked move when one authoritative object is missing", async () => {
    const { committed, database } = linkedDatabase({ missingDeja: true });
    await expect(saveLinkedCampaignPlacements({ placements: linkedPlacements }, database)).rejects.toThrow(/not an authoritative campaign object/);
    expect(committed).toEqual([]);
  });

  it("rejects incomplete and duplicate linked groups before opening a transaction", async () => {
    const { database, transaction } = linkedDatabase();
    await expect(saveLinkedCampaignPlacements({ placements: linkedPlacements.slice(0, 2) }, database)).rejects.toThrow(/exactly 1 DEJA_VU/);
    await expect(saveLinkedCampaignPlacements({ placements: [linkedPlacements[0]!, linkedPlacements[0]!, linkedPlacements[1]!, linkedPlacements[2]!] }, database)).rejects.toThrow(/cannot repeat/);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("updates all three editable grouping values in one serializable transaction", async () => {
    const values = defaultDisjointTrilogy("CONCORD").map((value) => ({ ...value, bookNumbers: [...value.bookNumbers] }));
    const updates: unknown[] = [];
    const client = {
      bookGroupingValue: {
        findMany: vi.fn()
          .mockResolvedValueOnce(values.map(({ bookGroupingValueId }) => ({ bookGroupingValueId })))
          .mockResolvedValueOnce(values),
        update: vi.fn(async (input) => { updates.push(input); return input; }),
      },
    };
    const transaction = vi.fn(async (work: (value: typeof client) => Promise<unknown>) => work(client));
    const database = { $transaction: transaction } as unknown as PrismaClient;

    await saveDisjointTrilogy({ worldKey: "CONCORD", values }, database);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(updates).toHaveLength(3);
  });
});
