import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { BulkOperation, ImportResultState } from "../generated/prisma/enums";
import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";

const lifetimeMilliseconds = 30 * 60 * 1000;

export interface BulkApiAccess {
  externalBulkApiSessionId: string;
  issuedByUserId: string;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export async function generateExternalBulkApiKey(issuedByUserId: string, database: PrismaClient = getDatabase(), now = new Date()): Promise<{ expiresAt: Date; key: string; sessionId: string }> {
  const key = `eid_tmp_${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(now.valueOf() + lifetimeMilliseconds);
  const sessionId = randomUUID();
  await database.$transaction(async (transaction) => {
    await transaction.externalBulkApiSession.updateMany({
      data: { revokedAt: now, state: "OFF" },
      where: { revokedAt: null, state: "ON" },
    });
    await transaction.externalBulkApiSession.create({
      data: { createdAt: now, expiresAt, externalBulkApiSessionId: sessionId, issuedByUserId, keyHash: hashKey(key), state: "ON" },
    });
  });
  return { expiresAt, key, sessionId };
}

export async function revokeExternalBulkApiKey(sessionId: string, database: PrismaClient = getDatabase(), now = new Date()): Promise<void> {
  const result = await database.externalBulkApiSession.updateMany({
    data: { revokedAt: now, state: "OFF" },
    where: { externalBulkApiSessionId: sessionId, revokedAt: null, state: "ON" },
  });
  if (result.count !== 1) throw new Error("Active external bulk API session not found.");
}

export async function externalBulkApiOverview(database: PrismaClient = getDatabase(), now = new Date()) {
  const [activeSession, audits] = await Promise.all([
    database.externalBulkApiSession.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, expiresAt: true, externalBulkApiSessionId: true, issuedBy: { select: { email: true, name: true } } },
      where: { expiresAt: { gt: now }, revokedAt: null, state: "ON" },
    }),
    database.bulkOperationAudit.findMany({
      orderBy: { occurredAt: "desc" },
      select: { actor: { select: { email: true, name: true } }, bulkOperationAuditId: true, detail: true, entityName: true, occurredAt: true, operation: true, recordCount: true, result: true },
      take: 100,
    }),
  ]);
  return { activeSession, audits, maximumLifetimeMinutes: 30, state: activeSession ? "ON" as const : "OFF" as const };
}

export async function authenticateExternalBulkApi(request: Request, database: PrismaClient = getDatabase(), now = new Date()): Promise<BulkApiAccess> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(eid_tmp_[A-Za-z0-9_-]+)$/.exec(authorization);
  if (!match) throw new Response("A valid temporary bulk API bearer key is required.", { status: 401 });
  const session = await database.externalBulkApiSession.findUnique({ where: { keyHash: hashKey(match[1]) } });
  if (!session || session.state !== "ON" || session.revokedAt || session.expiresAt <= now) throw new Response("The temporary bulk API key is invalid, expired, or revoked.", { status: 401 });
  return { externalBulkApiSessionId: session.externalBulkApiSessionId, issuedByUserId: session.issuedByUserId };
}

export async function recordBulkOperation(input: {
  actorUserId?: string;
  database?: PrismaClient;
  detail?: string;
  entityName: string;
  externalBulkApiSessionId?: string;
  operation: BulkOperation;
  recordCount: number;
  result: ImportResultState;
}): Promise<void> {
  if (!input.actorUserId && !input.externalBulkApiSessionId) throw new Error("Bulk operation audit requires an actor or external session.");
  const database = input.database ?? getDatabase();
  await database.bulkOperationAudit.create({
    data: {
      actorUserId: input.actorUserId,
      bulkOperationAuditId: randomUUID(),
      detail: input.detail?.slice(0, 500),
      entityName: input.entityName,
      externalBulkApiSessionId: input.externalBulkApiSessionId,
      operation: input.operation,
      recordCount: input.recordCount,
      result: input.result,
    },
  });
}
