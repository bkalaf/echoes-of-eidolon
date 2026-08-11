import { randomUUID } from "node:crypto";
import { z } from "zod";

import { CampaignBookRangeError, campaignObjectTypes, isValidCampaignSpan } from "../domain/campaign-planner";
import { WorldKey } from "../generated/prisma/enums";
import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";

type Database = PrismaClient;

export const campaignPlacementInputSchema = z.object({
  bookNumbers: z.array(z.int().min(1).max(18)).min(1),
  name: z.string().trim().min(1).max(200),
  objectId: z.string().trim().min(1).max(200),
  objectType: z.enum(campaignObjectTypes),
  worldKey: z.enum(WorldKey),
}).strict();

export async function getCampaign(worldKey: WorldKey, database: Database = getDatabase()) {
  return database.campaign.findUnique({
    where: { worldKey },
    include: { placements: { orderBy: { ordinal: "asc" } } },
  });
}

export async function saveCampaignPlacement(input: z.infer<typeof campaignPlacementInputSchema>, database: Database = getDatabase()) {
  if (!isValidCampaignSpan(input.objectType, input.bookNumbers)) throw new CampaignBookRangeError("The selected Books do not form a valid span for this campaign object type.");
  const bookNumbers = [...input.bookNumbers].sort((left, right) => left - right);
  return database.$transaction(async (transaction) => {
    const campaign = await transaction.campaign.upsert({
      where: { worldKey: input.worldKey },
      create: { campaignId: randomUUID(), name: input.name, worldKey: input.worldKey },
      update: { name: input.name },
    });
    const existing = await transaction.campaignPlacement.findUnique({
      where: { campaignId_objectType_objectId: { campaignId: campaign.campaignId, objectId: input.objectId, objectType: input.objectType } },
    });
    const maximum = await transaction.campaignPlacement.aggregate({ where: { campaignId: campaign.campaignId }, _max: { ordinal: true } });
    return transaction.campaignPlacement.upsert({
      where: { campaignId_objectType_objectId: { campaignId: campaign.campaignId, objectId: input.objectId, objectType: input.objectType } },
      create: { campaignPlacementId: randomUUID(), campaignId: campaign.campaignId, objectId: input.objectId, objectType: input.objectType, bookNumbers, ordinal: (maximum._max.ordinal ?? 0) + 1 },
      update: { bookNumbers, ordinal: existing?.ordinal ?? (maximum._max.ordinal ?? 0) + 1 },
    });
  }, { isolationLevel: "Serializable" });
}
