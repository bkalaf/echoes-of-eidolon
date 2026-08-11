import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";

type Database = PrismaClient;

export interface NpcRuntimeProvider {
  respond(input: { inputText: string; sessionId: string; userId: string }): Promise<{ providerReference: string; responseText: string }>;
}

export const gameTurnInputSchema = z.object({ inputText: z.string().trim().min(1).max(4_000) }).strict();

export async function getPlayerRuntime(userId: string, database: Database = getDatabase()) {
  const session = await database.gameSession.findFirst({
    where: { userId },
    orderBy: { lastActiveAt: "desc" },
    include: {
      settlementWorld: {
        select: {
          worldKey: true,
          settlement: {
            select: {
              classification: true,
              name: true,
              site: { select: { latitude: true, longitude: true, regionId: true, siteId: true } },
            },
          },
        },
      },
      turns: { orderBy: { sequence: "asc" }, take: 50 },
    },
  });
  return {
    sessionId: session?.gameSessionId ?? null,
    nearby: [] as const,
    exits: [] as const,
    location: session?.settlementWorld ? {
      classification: session.settlementWorld.settlement.classification,
      latitude: session.settlementWorld.settlement.site.latitude,
      longitude: session.settlementWorld.settlement.site.longitude,
      name: session.settlementWorld.settlement.name,
      regionId: session.settlementWorld.settlement.site.regionId,
      siteId: session.settlementWorld.settlement.site.siteId,
      worldKey: session.settlementWorld.worldKey,
    } : null,
    turns: session?.turns.map((turn) => ({
      gameTurnId: turn.gameTurnId,
      inputText: turn.inputText,
      responseText: turn.responseText,
      sequence: turn.sequence,
      status: turn.status,
    })) ?? [],
  };
}

export async function submitGameTurn(
  input: { inputText: string; userId: string },
  provider: NpcRuntimeProvider | undefined,
  database: Database = getDatabase(),
) {
  const turn = await database.$transaction(async (transaction) => {
    let session = await transaction.gameSession.findFirst({ where: { userId: input.userId }, orderBy: { lastActiveAt: "desc" } });
    if (!session) session = await transaction.gameSession.create({ data: { gameSessionId: randomUUID(), userId: input.userId } });
    const latest = await transaction.gameTurn.aggregate({ where: { gameSessionId: session.gameSessionId }, _max: { sequence: true } });
    return transaction.gameTurn.create({
      data: {
        gameTurnId: randomUUID(),
        gameSessionId: session.gameSessionId,
        inputText: input.inputText,
        sequence: (latest._max.sequence ?? 0) + 1,
        status: provider ? "PROVIDER_PENDING" : "FAILED",
        failureReason: provider ? null : "NPC runtime provider is not configured.",
      },
    });
  }, { isolationLevel: "Serializable" });
  if (!provider) return { ...turn, providerAvailable: false as const };

  try {
    const result = await provider.respond({ inputText: input.inputText, sessionId: turn.gameSessionId, userId: input.userId });
    const completed = await database.gameTurn.update({
      where: { gameTurnId: turn.gameTurnId },
      data: { completedAt: new Date(), providerReference: result.providerReference, responseText: result.responseText, status: "COMPLETED" },
    });
    return { ...completed, providerAvailable: true as const };
  } catch (error) {
    await database.gameTurn.update({
      where: { gameTurnId: turn.gameTurnId },
      data: { completedAt: new Date(), failureReason: error instanceof Error ? error.message.slice(0, 500) : "Provider request failed", status: "FAILED" },
    });
    throw error;
  }
}
