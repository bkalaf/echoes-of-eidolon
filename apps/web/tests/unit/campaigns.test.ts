import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { defaultDisjointTrilogy } from "../../src/domain/campaign-planner";
import { createCampaignCatalogItem, reorderCampaignPlacement, saveDisjointTrilogy, saveLinkedCampaignPlacements } from "../../src/server/campaigns";

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
      companionDef: { findUnique: vi.fn().mockResolvedValue({ companionKey: "A" }) },
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
  it("reorders persisted placement ordinals without recreating identity or changing Books", async () => {
    const placements = [
      { bookNumbers: [1], campaignPlacementId: "PLACEMENT-A", objectId: "A", objectType: "WITNESS", ordinal: 1 },
      { bookNumbers: [4], campaignPlacementId: "PLACEMENT-B", objectId: "B", objectType: "WITNESS", ordinal: 2 },
      { bookNumbers: [8], campaignPlacementId: "PLACEMENT-C", objectId: "C", objectType: "WITNESS", ordinal: 3 },
    ];
    const update = vi.fn(async ({ data, where: { campaignPlacementId } }) => ({ ...placements.find((row) => row.campaignPlacementId === campaignPlacementId), ...data }));
    const transaction = {
      campaign: { findUnique: vi.fn().mockResolvedValue({ campaignId: "CAMPAIGN-1", placements }) },
      campaignPlacement: { update },
    };
    const database = { $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) } as unknown as PrismaClient;

    await reorderCampaignPlacement({ campaignPlacementId: "PLACEMENT-B", direction: "DOWN", worldKey: "RUIN" }, database);

    expect(update).toHaveBeenCalledWith({ data: { ordinal: 2 }, where: { campaignPlacementId: "PLACEMENT-C" } });
    expect(update).toHaveBeenCalledWith({ data: { ordinal: 3 }, where: { campaignPlacementId: "PLACEMENT-B" } });
    expect(transaction).not.toHaveProperty("campaignPlacement.create");
    expect(placements[1]!.bookNumbers).toEqual([4]);
  });

  it("supports drag-style move-before ordering while keeping every placement identity and Book span", async () => {
    const placements = [
      { bookNumbers: [1], campaignPlacementId: "PLACEMENT-A", objectId: "A", objectType: "WITNESS", ordinal: 1 },
      { bookNumbers: [4], campaignPlacementId: "PLACEMENT-B", objectId: "B", objectType: "WITNESS", ordinal: 2 },
      { bookNumbers: [8], campaignPlacementId: "PLACEMENT-C", objectId: "C", objectType: "WITNESS", ordinal: 3 },
    ];
    const update = vi.fn(async ({ data, where: { campaignPlacementId } }) => ({ ...placements.find((row) => row.campaignPlacementId === campaignPlacementId), ...data }));
    const transaction = { campaign: { findUnique: vi.fn().mockResolvedValue({ campaignId: "CAMPAIGN-1", placements }) }, campaignPlacement: { update } };
    const database = { $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) } as unknown as PrismaClient;

    await reorderCampaignPlacement({ beforeCampaignPlacementId: "PLACEMENT-A", campaignPlacementId: "PLACEMENT-C", worldKey: "RUIN" }, database);

    expect(update).toHaveBeenCalledWith({ data: { ordinal: 1 }, where: { campaignPlacementId: "PLACEMENT-C" } });
    expect(update).toHaveBeenCalledWith({ data: { ordinal: 2 }, where: { campaignPlacementId: "PLACEMENT-A" } });
    expect(update).toHaveBeenCalledWith({ data: { ordinal: 3 }, where: { campaignPlacementId: "PLACEMENT-B" } });
    expect(placements.map(({ bookNumbers, campaignPlacementId }) => ({ bookNumbers, campaignPlacementId }))).toEqual([
      { bookNumbers: [1], campaignPlacementId: "PLACEMENT-A" },
      { bookNumbers: [4], campaignPlacementId: "PLACEMENT-B" },
      { bookNumbers: [8], campaignPlacementId: "PLACEMENT-C" },
    ]);
  });

  it("rejects an implicit cross-column drag before making any update", async () => {
    const placements = [
      { bookNumbers: [1], campaignPlacementId: "PLACEMENT-A", objectId: "A", objectType: "WITNESS", ordinal: 1 },
      { bookNumbers: [4, 5, 6, 7, 8, 9, 10, 11, 12], campaignPlacementId: "PLACEMENT-P", objectId: "P", objectType: "PILLAR", ordinal: 2 },
    ];
    const update = vi.fn();
    const transaction = { campaign: { findUnique: vi.fn().mockResolvedValue({ campaignId: "CAMPAIGN-1", placements }) }, campaignPlacement: { update } };
    const database = { $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) } as unknown as PrismaClient;

    await expect(reorderCampaignPlacement({ beforeCampaignPlacementId: "PLACEMENT-P", campaignPlacementId: "PLACEMENT-A", worldKey: "RUIN" }, database)).rejects.toThrow(/cannot move/);
    expect(update).not.toHaveBeenCalled();
  });

  it("creates only the minimal canonical LegendaryReward record", async () => {
    const create = vi.fn(async ({ data }) => data);
    const transaction = { legendaryReward: { create } };
    const database = { $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) } as unknown as PrismaClient;

    await expect(createCampaignCatalogItem({
      objectType: "LEGENDARY_REWARD",
      payload: { objectId: "LR-1", name: "The Lantern", description: "A canonical reward." },
    }, database)).resolves.toEqual({ legendaryRewardId: "LR-1", name: "The Lantern", description: "A canonical reward." });
    expect(create).toHaveBeenCalledWith({ data: { legendaryRewardId: "LR-1", name: "The Lantern", description: "A canonical reward." } });
  });

  it("creates Architect through Character shared identity and rejects independent subtype identity", async () => {
    const create = vi.fn(async ({ data }) => data);
    const transaction = { character: { create } };
    const database = { $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) } as unknown as PrismaClient;
    const canonical = {
      objectType: "ARCHITECT" as const,
      payload: {
        character: { characterId: "CHAR-1", displayName: "Ada", breedId: "BREED-1", worldKey: null, age: "37", skinScaleColor: "umber", hairFurColor: "black", eyeColor: "brown", clothing: "architect robes" },
        department: "COMPUTING",
      },
    };

    await createCampaignCatalogItem(canonical, database);
    expect(create).toHaveBeenCalledWith({
      data: {
        ...canonical.payload.character,
        architect: { create: { department: "COMPUTING" } },
      },
      include: { architect: true },
    });
    await expect(createCampaignCatalogItem({
      ...canonical,
      payload: { ...canonical.payload, architectId: "ARCH-1" },
    }, database)).rejects.toThrow(/unrecognized key/i);
    await expect(createCampaignCatalogItem({
      ...canonical,
      payload: { ...canonical.payload, character: { ...canonical.payload.character, breedId: null } },
    }, database)).rejects.toThrow(/Breed is required/);
  });

  it("creates Witness through Character shared identity and points to the Architect Character", async () => {
    const characterCreate = vi.fn(async ({ data }) => data);
    const transaction = {
      architect: { findUnique: vi.fn().mockResolvedValue({ characterId: "CHAR-ARCHITECT", department: "NAVIGATION", character: { characterId: "CHAR-ARCHITECT", soulId: "SOUL-1" } }), findUniqueOrThrow: vi.fn().mockResolvedValue({ characterId: "CHAR-ARCHITECT", department: "NAVIGATION" }) },
      character: { create: characterCreate },
      witnessDef: {
        findUnique: vi.fn().mockResolvedValue({ witnessDefId: "WDF_WITNESS_1", architectSoulId: "SOUL-1", department: "NAVIGATION" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ witnessDefId: "WDF_WITNESS_1", architectSoulId: "SOUL-1", department: "NAVIGATION" }),
      },
    };
    const database = { $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) } as unknown as PrismaClient;
    const payload = {
      character: { characterId: "CHAR-WITNESS", displayName: "Iona", breedId: "BREED-1", worldKey: null, soulId: "SOUL-1" },
      witnessDefId: "WDF_WITNESS_1",
      trueFlawName: "Certainty",
      architectCharacterId: "CHAR-ARCHITECT",
      legendaryRewardId: "REWARD-1",
    } as const;

    await createCampaignCatalogItem({ objectType: "WITNESS", payload }, database);
    expect(characterCreate).toHaveBeenCalledWith({
      data: {
        ...payload.character,
        witness: { create: { architectCharacterId: "CHAR-ARCHITECT", constellationAfterId: null, constellationBeforeId: null, legendaryRewardId: "REWARD-1", trueFlawName: "Certainty", witnessDefId: "WDF_WITNESS_1" } },
      },
      include: { witness: true },
    });
    await expect(createCampaignCatalogItem({ objectType: "WITNESS", payload: { ...payload, witnessId: "WIT-1" } }, database)).rejects.toThrow(/unrecognized key/i);
  });

  it("rejects a Campaign Witness whose Soul differs from its source Architect", async () => {
    const transaction = {
      architect: { findUnique: vi.fn().mockResolvedValue({ characterId: "CHAR-ARCHITECT", department: "NAVIGATION", character: { characterId: "CHAR-ARCHITECT", soulId: "SOUL-1" } }), findUniqueOrThrow: vi.fn().mockResolvedValue({ characterId: "CHAR-ARCHITECT", department: "NAVIGATION" }) },
      character: { create: vi.fn() },
      witnessDef: {
        findUnique: vi.fn().mockResolvedValue({ witnessDefId: "WDF_WITNESS_1", architectSoulId: "SOUL-1", department: "NAVIGATION" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ witnessDefId: "WDF_WITNESS_1", architectSoulId: "SOUL-1", department: "NAVIGATION" }),
      },
    };
    const database = { $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) } as unknown as PrismaClient;
    await expect(createCampaignCatalogItem({
      objectType: "WITNESS",
      payload: {
        character: { characterId: "CHAR-WITNESS", displayName: "Iona", breedId: "BREED-1", soulId: "SOUL-2" },
        witnessDefId: "WDF_WITNESS_1",
        architectCharacterId: "CHAR-ARCHITECT",
      },
    }, database)).rejects.toThrow("Witness and source Architect must reference the same Soul.");
    expect(transaction.character.create).not.toHaveBeenCalled();
  });

  it("rejects null-Breed Witness and Companion Characters", async () => {
    const transaction = {
      architect: { findUnique: vi.fn().mockResolvedValue({ characterId: "CHAR-ARCHITECT", department: "NAVIGATION", character: { characterId: "CHAR-ARCHITECT", soulId: "SOUL-1" } }), findUniqueOrThrow: vi.fn().mockResolvedValue({ characterId: "CHAR-ARCHITECT", department: "NAVIGATION" }) },
      character: { create: vi.fn() },
      companion: { createMany: vi.fn() },
      companionDef: { create: vi.fn() },
      witnessDef: { findUnique: vi.fn().mockResolvedValue({ witnessDefId: "WDF_WITNESS_1", architectSoulId: "SOUL-1", department: "NAVIGATION" }), findUniqueOrThrow: vi.fn().mockResolvedValue({ witnessDefId: "WDF_WITNESS_1", architectSoulId: "SOUL-1", department: "NAVIGATION" }) },
    };
    const database = { $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) } as unknown as PrismaClient;
    await expect(createCampaignCatalogItem({
      objectType: "WITNESS",
      payload: { character: { characterId: "CHAR-WITNESS", displayName: "Witness", breedId: null, soulId: "SOUL-1" }, witnessDefId: "WDF_WITNESS_1", architectCharacterId: "CHAR-ARCHITECT" },
    }, database)).rejects.toThrow(/Breed is required/);
    const companion = (worldKey: "CONCORD" | "RUIN" | "SCHISM") => ({ characterId: `CHAR-${worldKey}`, displayName: worldKey, breedId: null, soulId: "SOUL-COMPANION", worldKey });
    await expect(createCampaignCatalogItem({
      objectType: "COMPANION",
      payload: { companionKey: "A", soulId: "SOUL-COMPANION", heirloom: "NECKLACE", knowledgeSkill: null, awarenessSkill: null, concordCharacter: companion("CONCORD"), ruinCharacter: companion("RUIN"), schismCharacter: companion("SCHISM") },
    }, database)).rejects.toThrow(/Breed is required/);
    expect(transaction.character.create).not.toHaveBeenCalled();
  });

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
