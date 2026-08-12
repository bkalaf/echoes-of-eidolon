import { isFirstAssignedBookCompletion } from "../domain/transformation";
import type { CompanionKey, EntityType } from "../generated/prisma/enums";
import type { PrismaClient } from "../generated/prisma/client";
import { appendCapabilityEventInTransaction } from "./capability-ledger";
import { getDatabase } from "./database";

export async function recordBookCompletionTransformation(input: { campaignId: string; companionKey: CompanionKey; completedBookNumber: number; occurredAt: Date }, database: PrismaClient = getDatabase()) {
  return database.$transaction(async (transaction) => {
    const [campaign, placement, companion, binding] = await Promise.all([
      transaction.campaign.findUniqueOrThrow({ where: { campaignId: input.campaignId } }),
      transaction.campaignPlacement.findFirst({ where: { campaignId: input.campaignId, objectType: "COMPANION", objectId: input.companionKey } }),
      transaction.companion.findUniqueOrThrow({ where: { companionKey: input.companionKey }, include: { concordProtagonist: true, ruinProtagonist: true, schismProtagonist: true } }),
      transaction.companionTransformationBinding.findUnique({ where: { companionKey: input.companionKey } }),
    ]);
    if (!placement || !binding || !isFirstAssignedBookCompletion(placement.bookNumbers, input.completedBookNumber)) return { transformed: false as const };
    const protagonist = campaign.worldKey === "CONCORD" ? companion.concordProtagonist : campaign.worldKey === "RUIN" ? companion.ruinProtagonist : companion.schismProtagonist;
    const resolver = async (entityType: EntityType, entityId: string) => entityType === "COMPANION"
      ? Boolean(await transaction.companion.findUnique({ where: { companionKey: entityId as CompanionKey }, select: { companionKey: true } }))
      : entityType === "LAYETTE" ? Boolean(await transaction.layette.findUnique({ where: { layetteId: entityId }, select: { layetteId: true } })) : false;
    const common = { scopeType: "CHARACTER" as const, scopeId: protagonist.characterId, version: 1, bindings: { COMPANION: input.companionKey }, operation: "SET" as const, occurredAt: input.occurredAt };
    const transformation = await appendCapabilityEventInTransaction({ ...common, code: "COMPANION_TRANSFORMATION_COMPLETE", value: true, idempotencyKey: `transformation:${input.campaignId}:${input.companionKey}` }, transaction, resolver);
    const layette = await appendCapabilityEventInTransaction({ ...common, code: "COMPANION_LAYETTE_GRANTED", value: { entityType: "LAYETTE", entityId: binding.layetteId }, idempotencyKey: `transformation-layette:${input.campaignId}:${input.companionKey}` }, transaction, resolver);
    return { transformed: true as const, transformation, layette };
  });
}
