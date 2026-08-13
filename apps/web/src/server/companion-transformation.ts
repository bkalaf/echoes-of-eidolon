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
      transaction.companionDef.findUniqueOrThrow({ where: { companionKey: input.companionKey }, include: { concordCharacter: true, ruinCharacter: true, schismCharacter: true } }),
      transaction.companionTransformationBinding.findUnique({ where: { companionKey: input.companionKey } }),
    ]);
    if (!placement || !binding || !isFirstAssignedBookCompletion(placement.bookNumbers, input.completedBookNumber)) return { transformed: false as const };
    const character = campaign.worldKey === "CONCORD" ? companion.concordCharacter : campaign.worldKey === "RUIN" ? companion.ruinCharacter : companion.schismCharacter;
    const resolver = async (entityType: EntityType, entityId: string) => entityType === "CHARACTER"
      ? Boolean(await transaction.character.findUnique({ where: { characterId: entityId }, select: { characterId: true } }))
      : entityType === "LAYETTE" ? Boolean(await transaction.layette.findUnique({ where: { layetteId: entityId }, select: { layetteId: true } })) : false;
    const common = { scopeType: "CHARACTER" as const, scopeId: character.characterId, version: 2, bindings: { CHARACTER: character.characterId }, operation: "SET" as const, occurredAt: input.occurredAt };
    const transformation = await appendCapabilityEventInTransaction({ ...common, code: "COMPANION_TRANSFORMATION_COMPLETE", value: true, idempotencyKey: `transformation:${input.campaignId}:${input.companionKey}` }, transaction, resolver);
    const layette = await appendCapabilityEventInTransaction({ ...common, code: "COMPANION_LAYETTE_GRANTED", value: { entityType: "LAYETTE", entityId: binding.layetteId }, idempotencyKey: `transformation-layette:${input.campaignId}:${input.companionKey}` }, transaction, resolver);
    return { transformed: true as const, transformation, layette };
  });
}
