import { randomUUID } from "node:crypto";

import { z } from "zod";

import { canAccessAdministration, type AuthorizationRole } from "../domain/authorization";
import { applyRecovery, projectRecoveryCondition } from "../domain/recovery";
import { currencyForWorld, projectWithdrawalWindow } from "../domain/world-economy";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";

const recoveryConfigurationSchema = z.object({
  greenMinimum: z.number(),
  yellowMinimum: z.number(),
  orangeMinimum: z.number(),
}).strict();
const innConfigurationSchema = z.object({ maximum: z.number().nonnegative(), actions: z.object({
  STAY: z.object({ cost: z.number().int().nonnegative(), rest: z.number().nonnegative(), morale: z.number().nonnegative(), comfort: z.number().nonnegative() }).strict(),
  EAT: z.object({ cost: z.number().int().nonnegative(), rest: z.number().nonnegative(), morale: z.number().nonnegative(), comfort: z.number().nonnegative() }).strict(),
}).strict() }).strict();
const companionKeys = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

export async function getPlayerGameplayProjection(userId: string, role: AuthorizationRole, database: PrismaClient = getDatabase()) {
  const [party, gameSession, recoveryPolicy] = await Promise.all([
    database.party.findFirst({
      orderBy: { createdAt: "desc" },
      where: { userId },
      include: {
        members: true,
        moneyTransactions: { orderBy: { occurredAtGameMinute: "desc" } },
        worldInstance: true,
      },
    }),
    database.gameSession.findFirst({
      orderBy: { lastActiveAt: "desc" },
      where: { userId },
      include: {
        currentPointOfInterest: { include: { services: { where: { active: true } } } },
        settlementWorld: { include: { settlement: { include: { soundtrackAssignments: { where: { active: true }, orderBy: { ordinal: "asc" }, include: { soundtrack: { include: { managedAsset: true } } } } } } } },
      },
    }),
    database.recoveryPolicy.findFirst({ where: { active: true }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!party) return { party: null };
  const companions = await database.companion.findMany({
    orderBy: { companionKey: "asc" },
    include: {
      soul: true,
      concordProtagonist: { include: { character: true } },
      ruinProtagonist: { include: { character: true } },
      schismProtagonist: { include: { character: true } },
    },
  });
  const memberByKey = new Map(party.members.map((member) => [member.companionKey, member]));
  const thresholds = recoveryPolicy ? recoveryConfigurationSchema.safeParse(recoveryPolicy.configuration) : undefined;
  const characterForWorld = (companion: typeof companions[number]) => party.worldInstance.worldKey === "CONCORD" ? companion.concordProtagonist.character : party.worldInstance.worldKey === "RUIN" ? companion.ruinProtagonist.character : companion.schismProtagonist.character;
  const characterIds = companions.map(characterForWorld).map((character) => character.characterId);
  const transformed = await database.capabilityState.findMany({
    select: { scopeId: true },
    where: { booleanValue: true, scopeId: { in: characterIds }, scopeType: "CHARACTER", capabilityAddress: { capabilityDefinition: { code: "COMPANION_TRANSFORMATION_COMPLETE" } } },
  });
  const transformedIds = new Set(transformed.map((state) => state.scopeId));
  const inventoryStates = await database.capabilityState.findMany({
    include: { capabilityAddress: true },
    where: { counterValue: { gt: 0 }, scopeId: party.partyId, scopeType: "PARTY", capabilityAddress: { capabilityDefinition: { code: "INVENTORY_ITEM_QUANTITY" } } },
  });
  const withdrawals = party.moneyTransactions.filter((transaction) => transaction.withdrawalAmount !== null).map((transaction) => ({ amount: transaction.withdrawalAmount!, occurredAtGameMinute: transaction.occurredAtGameMinute }));
  const withdrawal = party.withdrawalLimit === null ? null : projectWithdrawalWindow({ currentGameMinute: party.worldInstance.currentGameMinute, limit: party.withdrawalLimit, withdrawals });
  const services = gameSession?.currentPointOfInterest?.services.map((service) => service.service) ?? [];
  const innService = gameSession?.currentPointOfInterest?.services.find((service) => service.service === "INN");
  const innConfiguration = innService ? innConfigurationSchema.safeParse(innService.configuration) : undefined;
  const soundtrackCategory = services.includes("INN") ? "TAVERN" : "CITY";
  const soundtracks = gameSession?.settlementWorld?.settlement.soundtrackAssignments.filter((assignment) => assignment.category === soundtrackCategory).map((assignment) => assignment.soundtrack) ?? [];
  return {
    party: {
      partyId: party.partyId,
      worldKey: party.worldInstance.worldKey,
      currentGameMinute: party.worldInstance.currentGameMinute.toString(),
      currency: currencyForWorld(party.worldInstance.worldKey),
      purse: party.moneyTransactions.reduce((total, transaction) => total + transaction.delta, 0),
      withdrawal: withdrawal ? { ...withdrawal, nextLimitIncreaseAtGameMinute: withdrawal.nextLimitIncreaseAtGameMinute?.toString() ?? null, limit: party.withdrawalLimit } : null,
      withdrawals: withdrawals.map((entry) => ({ amount: entry.amount, occurredAtGameMinute: entry.occurredAtGameMinute.toString() })),
      inventory: inventoryStates.map((state) => ({ itemId: state.referenceEntityId ?? state.capabilityAddress.bindingsHash, name: state.referenceEntityId ?? "Authored item", quantity: Number(state.counterValue) })),
      companions: companionKeys.map((companionKey) => {
        const companion = companions.find((row) => row.companionKey === companionKey);
        if (!companion) return { companionKey, name: `Companion ${companionKey}`, condition: null, conditionSentence: "Authored companion data is unavailable.", transformed: false };
        const member = memberByKey.get(companion.companionKey);
        const character = characterForWorld(companion);
        const condition = member && thresholds?.success && member.rest !== null && member.morale !== null && member.comfort !== null
          ? projectRecoveryCondition({ rest: member.rest, morale: member.morale, comfort: member.comfort }, thresholds.data)
          : null;
        return { companionKey: companion.companionKey, name: character.displayName || companion.soul.name, condition, conditionSentence: member?.conditionSentence ?? null, transformed: transformedIds.has(character.characterId) };
      }),
      currentLocation: gameSession?.currentPointOfInterest ? { name: gameSession.currentPointOfInterest.name, services, innActions: innConfiguration?.success ? innConfiguration.data.actions : null } : null,
      soundtracks: soundtracks.map((soundtrack) => ({ soundtrackId: soundtrack.soundtrackId, assetUrl: `/${soundtrack.managedAsset.objectKey}`, displayName: canAccessAdministration(role) ? soundtrack.displayName : null })),
    },
  };
}

export async function applyCurrentInnService(userId: string, action: "STAY" | "EAT", database: PrismaClient = getDatabase()) {
  return database.$transaction(async (transaction) => {
    const session = await transaction.gameSession.findFirst({ orderBy: { lastActiveAt: "desc" }, where: { userId }, include: { currentPointOfInterest: { include: { services: true } }, party: { include: { members: true, moneyTransactions: true, worldInstance: true } } } });
    const service = session?.currentPointOfInterest?.services.find((entry) => entry.active && entry.service === "INN");
    if (!session?.party || !service) throw new Error("A current-world Inn interaction is required.");
    const configuration = innConfigurationSchema.safeParse(service.configuration);
    if (!configuration.success) throw new Error("This Inn has no authored stay/eat recovery policy.");
    const effect = configuration.data.actions[action];
    const purse = session.party.moneyTransactions.reduce((sum, transaction) => sum + transaction.delta, 0);
    if (purse < effect.cost) throw new Error(`The party does not have enough ${currencyForWorld(session.party.worldInstance.worldKey).name}.`);
    if (effect.cost > 0) await transaction.moneyTransaction.create({ data: { moneyTransactionId: randomUUID(), partyId: session.party.partyId, worldInstanceId: session.party.worldInstanceId, delta: -effect.cost, occurredAtGameMinute: session.party.worldInstance.currentGameMinute, context: { action, pointOfInterestId: session.currentPointOfInterestId, source: "INN" } as Prisma.InputJsonValue } });
    for (const member of session.party.members) {
      if (member.rest === null || member.morale === null || member.comfort === null) continue;
      const next = applyRecovery({ rest: member.rest, morale: member.morale, comfort: member.comfort }, effect, configuration.data.maximum);
      await transaction.partyMember.update({ where: { partyId_companionKey: { partyId: member.partyId, companionKey: member.companionKey } }, data: next });
    }
    return { action, cost: effect.cost };
  }, { isolationLevel: "Serializable" });
}

export async function withdrawFromCurrentBank(userId: string, amount: number, database: PrismaClient = getDatabase()) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Withdrawal amount must be a positive integer.");
  return database.$transaction(async (transaction) => {
    const session = await transaction.gameSession.findFirst({
      orderBy: { lastActiveAt: "desc" }, where: { userId },
      include: { currentPointOfInterest: { include: { services: true } }, party: { include: { moneyTransactions: true, worldInstance: true } } },
    });
    if (!session?.party || !session.currentPointOfInterest?.services.some((service) => service.active && service.service === "BANK")) {
      throw new Error("A current-world Bank interaction is required.");
    }
    if (session.party.withdrawalLimit === null) throw new Error("No withdrawal policy is configured for this party.");
    const window = projectWithdrawalWindow({
      currentGameMinute: session.party.worldInstance.currentGameMinute,
      limit: session.party.withdrawalLimit,
      withdrawals: session.party.moneyTransactions.filter((entry) => entry.withdrawalAmount !== null).map((entry) => ({ amount: entry.withdrawalAmount!, occurredAtGameMinute: entry.occurredAtGameMinute })),
    });
    if (amount > window.remaining) throw new Error("The requested withdrawal exceeds the rolling seven-day allowance.");
    await transaction.moneyTransaction.create({ data: {
      moneyTransactionId: randomUUID(), partyId: session.party.partyId, worldInstanceId: session.party.worldInstanceId,
      delta: amount, withdrawalAmount: amount, occurredAtGameMinute: session.party.worldInstance.currentGameMinute,
      context: { pointOfInterestId: session.currentPointOfInterestId, source: "BANK" } as Prisma.InputJsonValue,
    } });
    return { amount, remaining: window.remaining - amount };
  }, { isolationLevel: "Serializable" });
}
