import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import type { BulkOperation, ExternalBulkApiState, ImportResultState } from "../generated/prisma/enums";
import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";

const lifetimeMilliseconds = 60 * 60 * 1000;

export interface BulkApiAccess {
  externalBulkApiSessionId: string;
  issuedByUserId: string;
  mode: "KEYED" | "KEYLESS";
}

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function keyMatches(supplied: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashKey(supplied), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function generateExternalBulkApiKey(issuedByUserId: string, database: PrismaClient = getDatabase(), now = new Date()): Promise<{ expiresAt: Date; key: string; sessionId: string }> {
  const key = `eid_tmp_${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(now.valueOf() + lifetimeMilliseconds);
  const sessionId = randomUUID();
  await database.$transaction(async (transaction) => {
    await transaction.externalBulkApiSession.updateMany({
      data: { revokedAt: now, state: "OFF" },
      where: { revokedAt: null, state: { in: ["KEYED", "KEYLESS"] } },
    });
    await transaction.externalBulkApiSession.create({
      data: { createdAt: now, expiresAt, externalBulkApiSessionId: sessionId, issuedByUserId, keyHash: hashKey(key), lastActivityAt: now, state: "KEYED" },
    });
  });
  return { expiresAt, key, sessionId };
}

export async function revokeExternalBulkApiKey(sessionId: string, database: PrismaClient = getDatabase(), now = new Date()): Promise<void> {
  const result = await database.externalBulkApiSession.updateMany({
    data: { revokedAt: now, state: "OFF" },
    where: { externalBulkApiSessionId: sessionId, revokedAt: null, state: { in: ["KEYED", "KEYLESS"] } },
  });
  if (result.count !== 1) throw new Error("Active external bulk API session not found.");
}

export async function externalBulkApiOverview(database: PrismaClient = getDatabase(), now = new Date()) {
  const inactivityCutoff = new Date(now.valueOf() - lifetimeMilliseconds);
  await database.externalBulkApiSession.updateMany({
    data: { revokedAt: now, state: "OFF" },
    where: { lastActivityAt: { lte: inactivityCutoff }, revokedAt: null, state: { in: ["KEYED", "KEYLESS"] } },
  });
  const [activeSession, audits, envelopeRows] = await Promise.all([
    database.externalBulkApiSession.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, externalBulkApiSessionId: true, issuedBy: { select: { email: true, name: true } }, lastActivityAt: true, state: true },
      where: { lastActivityAt: { gt: inactivityCutoff }, revokedAt: null, state: { in: ["KEYED", "KEYLESS"] } },
    }),
    database.bulkOperationAudit.findMany({
      orderBy: { occurredAt: "desc" },
      select: { actor: { select: { email: true, name: true } }, bulkOperationAuditId: true, detail: true, entityName: true, occurredAt: true, operation: true, recordCount: true, result: true },
      take: 100,
    }),
    database.bulkMutationEnvelope.findMany({
      orderBy: { sequence: "asc" },
      select: { bulkMutationEnvelopeId: true, decidedAt: true, dryRunResult: true, entityCode: true, notes: true, operation: true, receivedAt: true, recordCount: true, revalidationResult: true, sequence: true, status: true },
      take: 250,
    }),
  ]);
  const envelopes = envelopeRows.map((entry) => ({ ...entry, sequence: entry.sequence.toString() }));
  return { activeSession, audits, envelopes, maximumLifetimeMinutes: 60, state: activeSession?.state ?? "OFF" as const };
}

export async function authenticateExternalBulkApi(request: Request, database: PrismaClient = getDatabase(), now = new Date()): Promise<BulkApiAccess> {
  const inactivityCutoff = new Date(now.valueOf() - lifetimeMilliseconds);
  await database.externalBulkApiSession.updateMany({
    data: { revokedAt: now, state: "OFF" },
    where: { lastActivityAt: { lte: inactivityCutoff }, revokedAt: null, state: { in: ["KEYED", "KEYLESS"] } },
  });
  const active = await database.externalBulkApiSession.findFirst({
    orderBy: { createdAt: "desc" },
    where: { lastActivityAt: { gt: inactivityCutoff }, revokedAt: null, state: { in: ["KEYED", "KEYLESS"] } },
  });
  if (!active) throw new Response("The external bulk gateway is off or inactive.", { status: 503 });
  const mode = active.state as Extract<ExternalBulkApiState, "KEYED" | "KEYLESS">;
  if (mode === "KEYED") {
    const legacy = /^Bearer\s+(eid_tmp_[A-Za-z0-9_-]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
    const supplied = request.headers.get("x-eidolon-bulk-key") ?? legacy;
    if (!supplied || !active.keyHash || !keyMatches(supplied, active.keyHash)) {
      throw new Response("A valid temporary bulk API key is required.", { status: 401 });
    }
  }
  await database.externalBulkApiSession.update({ where: { externalBulkApiSessionId: active.externalBulkApiSessionId }, data: { lastActivityAt: now } });
  return { externalBulkApiSessionId: active.externalBulkApiSessionId, issuedByUserId: active.issuedByUserId, mode };
}

export async function enableKeylessExternalBulkApi(issuedByUserId: string, database: PrismaClient = getDatabase(), now = new Date()) {
  const sessionId = randomUUID();
  await database.$transaction(async (transaction) => {
    await transaction.externalBulkApiSession.updateMany({
      data: { revokedAt: now, state: "OFF" },
      where: { revokedAt: null, state: { in: ["KEYED", "KEYLESS"] } },
    });
    await transaction.externalBulkApiSession.create({
      data: { createdAt: now, expiresAt: new Date(now.valueOf() + lifetimeMilliseconds), externalBulkApiSessionId: sessionId, issuedByUserId, keyHash: null, lastActivityAt: now, state: "KEYLESS" },
    });
  });
  return { expiresAfterInactivityMinutes: 60, sessionId, state: "KEYLESS" as const };
}

export async function recordBulkOperation(input: {
  actorUserId?: string;
  database?: PrismaClient;
  detail?: string;
  entityName: string;
  externalBulkApiSessionId?: string;
  bulkMutationEnvelopeId?: string;
  operation: BulkOperation;
  recordCount: number;
  result: ImportResultState;
}): Promise<void> {
  if (!input.actorUserId && !input.externalBulkApiSessionId) throw new Error("Bulk operation audit requires an actor or external session.");
  const database = input.database ?? getDatabase();
  await database.bulkOperationAudit.create({
    data: {
      actorUserId: input.actorUserId,
      bulkMutationEnvelopeId: input.bulkMutationEnvelopeId,
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
