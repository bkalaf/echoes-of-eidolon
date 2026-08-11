import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  CampaignBookRangeError,
  campaignLinkedGroups,
  campaignObjectTypes,
  isValidCampaignSpan,
  linkedCampaignGroup,
  opposingFactionGrouping,
  validateDisjointTrilogy,
  type BookGroupingValueContract,
  type CampaignObjectType,
} from "../domain/campaign-planner";
import { CompanionKey, EntityType, Holiday, InterludeType, TimelineEventType, WorldKey } from "../generated/prisma/enums";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";

type Database = PrismaClient;
type Transaction = Prisma.TransactionClient;

export interface CampaignCatalogItem {
  label: string;
  objectId: string;
  objectType: CampaignObjectType;
}

export const campaignPlacementInputSchema = z.object({
  bookNumbers: z.array(z.int().min(1).max(18)).min(1),
  name: z.string().trim().min(1).max(200),
  objectId: z.string().trim().min(1).max(200),
  objectType: z.enum(campaignObjectTypes),
  worldKey: z.enum(WorldKey),
}).strict();

export const linkedCampaignPlacementInputSchema = z.object({
  placements: z.array(campaignPlacementInputSchema).min(1),
}).strict();

const groupingValueSchema = z.object({
  bookGroupingValueId: z.string().trim().min(1),
  logicalKey: z.string().trim().min(1),
  bookNumbers: z.array(z.int().min(1).max(18)).min(1),
  ordinal: z.int().min(0),
  valueRefType: z.enum(EntityType).nullable().optional(),
  valueRefId: z.string().trim().min(1).nullable().optional(),
}).strict();

export const bookGroupingUpdateSchema = z.object({
  worldKey: z.enum(WorldKey),
  values: z.array(groupingValueSchema).length(3),
}).strict();

export async function getCampaign(worldKey: WorldKey, database: Database = getDatabase()) {
  return database.campaign.findUnique({
    where: { worldKey },
    include: { placements: { orderBy: { ordinal: "asc" } } },
  });
}

async function campaignCatalog(database: Database): Promise<Record<CampaignObjectType, CampaignCatalogItem[]>> {
  const [pillars, lessons, timelineEvents, transitions, interludes, companions, witnesses, architects, rewards] = await Promise.all([
    database.pillar.findMany({ select: { pillarId: true, name: true }, orderBy: { pillarId: "asc" } }),
    database.lesson.findMany({ select: { lessonId: true, name: true }, orderBy: { lessonId: "asc" } }),
    database.timelineEvent.findMany({ select: { timelineEventId: true, name: true, timelineEventType: true }, orderBy: { timelineEventId: "asc" } }),
    database.transition.findMany({ select: { transitionId: true, name: true }, orderBy: { transitionId: "asc" } }),
    database.interlude.findMany({ select: { interludeId: true, name: true, interludeType: true }, orderBy: { interludeId: "asc" } }),
    database.companion.findMany({ select: { companionKey: true }, orderBy: { companionKey: "asc" } }),
    database.witness.findMany({ select: { witnessId: true }, orderBy: { witnessId: "asc" } }),
    database.architect.findMany({ select: { architectId: true, name: true }, orderBy: { architectId: "asc" } }),
    database.legendaryReward.findMany({ select: { legendaryRewardId: true, name: true }, orderBy: { legendaryRewardId: "asc" } }),
  ]);
  const catalog = campaignObjectTypes.reduce<Record<CampaignObjectType, CampaignCatalogItem[]>>((result, objectType) => {
    result[objectType] = [];
    return result;
  }, {} as Record<CampaignObjectType, CampaignCatalogItem[]>);
  const add = (objectType: CampaignObjectType, objectId: string, label: string) => catalog[objectType].push({ objectType, objectId, label });
  for (const item of pillars) add("PILLAR", item.pillarId, item.name);
  for (const item of lessons) add("LESSON", item.lessonId, item.name);
  for (const item of timelineEvents) add(item.timelineEventType as "ATROCITY" | "EXODUS" | "IN_TRANSIT", item.timelineEventId, item.name);
  for (const item of transitions) add("TRANSITION", item.transitionId, item.name);
  const interludeObjectType: Partial<Record<InterludeType, CampaignObjectType>> = {
    WWII: "WWII_INTERLUDE",
    HISTORICAL: "HISTORICAL_INTERLUDE",
    MYTH: "MYTH_INTERLUDE",
    SCIENCE: "SCIENCE_INTERLUDE",
    DEJA_VU: "DEJA_VU",
  };
  for (const item of interludes) {
    const objectType = interludeObjectType[item.interludeType];
    if (objectType) add(objectType, item.interludeId, item.name);
  }
  for (const item of companions) add("COMPANION", item.companionKey, item.companionKey);
  for (const item of witnesses) add("WITNESS", item.witnessId, item.witnessId);
  for (const item of architects) add("ARCHITECT", item.architectId, item.name);
  for (const item of rewards) add("LEGENDARY_REWARD", item.legendaryRewardId, item.name);
  for (const holiday of Object.values(Holiday)) add("HOLIDAY", holiday, holiday);
  return catalog;
}

export async function getCampaignWorkspace(worldKey: WorldKey, database: Database = getDatabase()) {
  const [campaign, catalog, groupingRows] = await Promise.all([
    getCampaign(worldKey, database),
    campaignCatalog(database),
    database.bookGroupingValue.findMany({
      where: { worldKey, definition: { groupingType: "DISJOINT_TRILOGY" } },
      orderBy: { ordinal: "asc" },
    }),
  ]);
  const assigned = new Map<CampaignObjectType, Set<string>>();
  for (const placement of campaign?.placements ?? []) {
    const values = assigned.get(placement.objectType) ?? new Set<string>();
    values.add(placement.objectId);
    assigned.set(placement.objectType, values);
  }
  const unassigned = Object.fromEntries(campaignObjectTypes.map((objectType) => [
    objectType,
    catalog[objectType].filter((item) => !assigned.get(objectType)?.has(item.objectId)),
  ])) as Record<CampaignObjectType, CampaignCatalogItem[]>;
  const disjoint = validateDisjointTrilogy(groupingRows, worldKey);
  return { campaign, unassigned, bookGroupings: { disjoint, opposingFaction: opposingFactionGrouping(worldKey) } };
}

async function assertCampaignObjectExists(transaction: Transaction, objectType: CampaignObjectType, objectId: string) {
  let exists = false;
  if (objectType === "PILLAR") exists = Boolean(await transaction.pillar.findUnique({ where: { pillarId: objectId }, select: { pillarId: true } }));
  else if (objectType === "LESSON") exists = Boolean(await transaction.lesson.findUnique({ where: { lessonId: objectId }, select: { lessonId: true } }));
  else if (["IN_TRANSIT", "EXODUS", "ATROCITY"].includes(objectType)) exists = Boolean(await transaction.timelineEvent.findFirst({ where: { timelineEventId: objectId, timelineEventType: objectType as TimelineEventType }, select: { timelineEventId: true } }));
  else if (objectType === "TRANSITION") exists = Boolean(await transaction.transition.findUnique({ where: { transitionId: objectId }, select: { transitionId: true } }));
  else if (["DEJA_VU", "WWII_INTERLUDE", "MYTH_INTERLUDE", "SCIENCE_INTERLUDE", "HISTORICAL_INTERLUDE"].includes(objectType)) {
    const typeByObject = { DEJA_VU: "DEJA_VU", WWII_INTERLUDE: "WWII", MYTH_INTERLUDE: "MYTH", SCIENCE_INTERLUDE: "SCIENCE", HISTORICAL_INTERLUDE: "HISTORICAL" } as const;
    exists = Boolean(await transaction.interlude.findFirst({ where: { interludeId: objectId, interludeType: typeByObject[objectType as keyof typeof typeByObject] }, select: { interludeId: true } }));
  } else if (objectType === "COMPANION" && Object.values(CompanionKey).includes(objectId as CompanionKey)) {
    exists = Boolean(await transaction.companion.findUnique({ where: { companionKey: objectId as CompanionKey }, select: { companionKey: true } }));
  }
  else if (objectType === "WITNESS") exists = Boolean(await transaction.witness.findUnique({ where: { witnessId: objectId }, select: { witnessId: true } }));
  else if (objectType === "ARCHITECT") exists = Boolean(await transaction.architect.findUnique({ where: { architectId: objectId }, select: { architectId: true } }));
  else if (objectType === "LEGENDARY_REWARD") exists = Boolean(await transaction.legendaryReward.findUnique({ where: { legendaryRewardId: objectId }, select: { legendaryRewardId: true } }));
  else if (objectType === "HOLIDAY") exists = Object.values(Holiday).includes(objectId as Holiday);
  if (!exists) throw new CampaignBookRangeError(`${objectType} ${objectId} is not an authoritative campaign object.`);
}

async function campaignForInput(input: z.infer<typeof campaignPlacementInputSchema>, transaction: Transaction) {
  return transaction.campaign.upsert({
    where: { worldKey: input.worldKey },
    create: { campaignId: randomUUID(), name: input.name, worldKey: input.worldKey },
    update: { name: input.name },
  });
}

async function savePlacement(input: z.infer<typeof campaignPlacementInputSchema>, campaignId: string, transaction: Transaction) {
  if (!isValidCampaignSpan(input.objectType, input.bookNumbers)) throw new CampaignBookRangeError("The selected Books do not form a valid span for this campaign object type.");
  await assertCampaignObjectExists(transaction, input.objectType, input.objectId);
  const bookNumbers = [...input.bookNumbers].sort((left, right) => left - right);
  const existing = await transaction.campaignPlacement.findUnique({
    where: { campaignId_objectType_objectId: { campaignId, objectId: input.objectId, objectType: input.objectType } },
  });
  const maximum = await transaction.campaignPlacement.aggregate({ where: { campaignId }, _max: { ordinal: true } });
  return transaction.campaignPlacement.upsert({
    where: { campaignId_objectType_objectId: { campaignId, objectId: input.objectId, objectType: input.objectType } },
    create: { campaignPlacementId: randomUUID(), campaignId, objectId: input.objectId, objectType: input.objectType, bookNumbers, ordinal: (maximum._max.ordinal ?? 0) + 1 },
    update: { bookNumbers, ordinal: existing?.ordinal ?? (maximum._max.ordinal ?? 0) + 1 },
  });
}

export async function saveCampaignPlacement(input: z.infer<typeof campaignPlacementInputSchema>, database: Database = getDatabase()) {
  if (linkedCampaignGroup(input.objectType)) throw new CampaignBookRangeError(`${input.objectType} must be committed with its complete linked group.`);
  return database.$transaction(async (transaction) => {
    const campaign = await campaignForInput(input, transaction);
    return savePlacement(input, campaign.campaignId, transaction);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function saveLinkedCampaignPlacements(input: z.infer<typeof linkedCampaignPlacementInputSchema>, database: Database = getDatabase()) {
  const placements = input.placements.map((placement) => campaignPlacementInputSchema.parse(placement));
  const first = placements[0]!;
  const identities = placements.map((placement) => `${placement.objectType}:${placement.objectId}`);
  if (new Set(identities).size !== identities.length) {
    throw new CampaignBookRangeError("A linked move cannot repeat the same campaign object.");
  }
  if (placements.some((placement) => placement.worldKey !== first.worldKey || placement.name !== first.name)) {
    throw new CampaignBookRangeError("A linked move must target one campaign and world.");
  }
  const rule = linkedCampaignGroup(first.objectType);
  if (!rule || placements.some((placement) => linkedCampaignGroup(placement.objectType) !== rule)) {
    throw new CampaignBookRangeError("A linked move must contain one complete governed linked group.");
  }
  for (const requirement of rule.required) {
    if (placements.filter((placement) => placement.objectType === requirement.objectType).length !== requirement.count) {
      throw new CampaignBookRangeError(`A linked move requires exactly ${requirement.count} ${requirement.objectType} placement(s).`);
    }
  }
  const allowed = new Set([...rule.required, ...rule.optional].map((member) => member.objectType));
  if (placements.some((placement) => !allowed.has(placement.objectType))) throw new CampaignBookRangeError("A linked move contains an unrelated object type.");
  return database.$transaction(async (transaction) => {
    const campaign = await campaignForInput(first, transaction);
    const saved = [];
    for (const placement of placements) saved.push(await savePlacement(placement, campaign.campaignId, transaction));
    return saved;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function saveDisjointTrilogy(input: z.infer<typeof bookGroupingUpdateSchema>, database: Database = getDatabase()) {
  const contracts: BookGroupingValueContract[] = input.values.map((value) => ({ ...value, worldKey: input.worldKey }));
  const projected = validateDisjointTrilogy(contracts, input.worldKey);
  return database.$transaction(async (transaction) => {
    const existing = await transaction.bookGroupingValue.findMany({
      where: { worldKey: input.worldKey, definition: { groupingType: "DISJOINT_TRILOGY", editability: "EDITABLE" } },
      select: { bookGroupingValueId: true },
    });
    const existingIds = new Set(existing.map((value) => value.bookGroupingValueId));
    if (existingIds.size !== projected.length || projected.some((value) => !existingIds.has(value.bookGroupingValueId))) {
      throw new CampaignBookRangeError("Editable grouping identities do not match the authoritative world values.");
    }
    for (const value of projected) {
      await transaction.bookGroupingValue.update({
        where: { bookGroupingValueId: value.bookGroupingValueId },
        data: {
          logicalKey: value.logicalKey,
          bookNumbers: [...value.bookNumbers],
          ordinal: value.ordinal,
          valueRefType: value.valueRefType ?? null,
          valueRefId: value.valueRefId ?? null,
        },
      });
    }
    return transaction.bookGroupingValue.findMany({ where: { worldKey: input.worldKey }, orderBy: { ordinal: "asc" } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export { campaignLinkedGroups };
