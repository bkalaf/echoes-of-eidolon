import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "../generated/prisma/client";
import type { BulkMutationEnvelope } from "../generated/prisma/client";
import { parseBulkRequest, type ParsedBulkRequest } from "../domain/bulk-gateway";
import { authenticateExternalBulkApi, recordBulkOperation } from "./bulk-operations";
import { getDatabase } from "./database";

export const bulkEntityAdapters = Object.freeze({
  occupation: {
    allowInsert: true,
    allowUpdate: true,
    allowDelete: true,
    allowFetch: true,
    allowKeylessFetch: true,
    fetchProjection: ["key", "name", "attributeAffinity", "active"],
  },
});

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function operationForStorage(operation: ParsedBulkRequest["operation"]) {
  if (operation === "INSERT") return "CREATE" as const;
  if (operation === "FETCH") return "QUERY" as const;
  return operation;
}

async function occupationDryRun(request: Exclude<ParsedBulkRequest, { operation: "FETCH" }>, database: PrismaClient) {
  const keys = request.operation === "INSERT"
    ? request.payload.records.map((record) => record.key)
    : request.payload.records.map((record) => record.match.key);
  const existing = await database.occupation.findMany({ select: { occupationId: true }, where: { occupationId: { in: keys } } });
  const existingKeys = new Set(existing.map((row) => row.occupationId));
  const errors = request.operation === "INSERT"
    ? keys.filter((key) => existingKeys.has(key)).map((key) => `Occupation ${key} already exists.`)
    : keys.filter((key) => !existingKeys.has(key)).map((key) => `Occupation ${key} does not exist.`);
  if (new Set(keys).size !== keys.length) errors.push("An envelope may mention each Occupation once.");
  return { valid: errors.length === 0, errors, warnings: [] as string[] };
}

export async function rerunBulkEnvelopeDryRun(envelopeId: string, database: PrismaClient = getDatabase()) {
  const envelope = await database.bulkMutationEnvelope.findUnique({ where: { bulkMutationEnvelopeId: envelopeId } });
  if (!envelope || ["APPLIED", "DELETED", "APPLYING"].includes(envelope.status)) throw new Error("The bulk envelope is not available for dry-run.");
  const request = parseStoredEnvelope(envelope);
  const dryRun = await occupationDryRun(request, database);
  return database.bulkMutationEnvelope.update({
    where: { bulkMutationEnvelopeId: envelopeId },
    data: { dryRunResult: dryRun, status: dryRun.valid ? "PENDING_REVIEW" : "DRY_RUN_FAILED" },
  });
}

export async function fetchBulkOccupations(request: Extract<ParsedBulkRequest, { operation: "FETCH" }>, database: PrismaClient = getDatabase()) {
  const filters = request.payload.where?.all ?? [];
  const rows = await database.occupation.findMany({
    include: { affinities: { orderBy: { ordinal: "asc" } } },
    orderBy: { occupationId: "asc" },
    take: request.payload.limit,
    where: filters.length ? { AND: filters.map((filter) => ({ affinities: { some: { abilityType: filter.value } } })) } : undefined,
  });
  return rows.map((row) => {
    const projection = {
      key: row.occupationId,
      name: row.name,
      active: row.active,
      attributeAffinity: row.affinities.map((affinity) => affinity.abilityType),
    };
    return Object.fromEntries(request.payload.select.map((field) => [field, projection[field]]));
  });
}

export async function queueBulkMutation(
  request: Exclude<ParsedBulkRequest, { operation: "FETCH" }>,
  access: { externalBulkApiSessionId: string },
  database: PrismaClient = getDatabase(),
) {
  const envelopeId = randomUUID();
  await database.bulkMutationEnvelope.create({
    data: {
      bulkMutationEnvelopeId: envelopeId,
      dryRunResult: { valid: false, errors: [], status: "DRY_RUN_RUNNING", warnings: [] },
      entityCode: request.payload.entity,
      externalBulkApiSessionId: access.externalBulkApiSessionId,
      notes: request.payload.notes,
      operation: operationForStorage(request.operation),
      payload: jsonValue(request.payload),
      recordCount: request.payload.records.length,
      sourceMetadata: { contractVersion: request.payload.version },
      status: "DRY_RUN_RUNNING",
    },
  });
  const dryRun = await occupationDryRun(request, database);
  const envelope = await database.bulkMutationEnvelope.update({
    where: { bulkMutationEnvelopeId: envelopeId },
    data: { dryRunResult: dryRun, status: dryRun.valid ? "PENDING_REVIEW" : "DRY_RUN_FAILED" },
  });
  await recordBulkOperation({
    bulkMutationEnvelopeId: envelopeId,
    database,
    detail: `Queued sequence ${envelope.sequence.toString()} with automatic dry-run ${dryRun.valid ? "passed" : "failed"}.`,
    entityName: request.payload.entity,
    externalBulkApiSessionId: access.externalBulkApiSessionId,
    operation: operationForStorage(request.operation),
    recordCount: request.payload.records.length,
    result: dryRun.valid ? "UNCHANGED" : "FAILED",
  });
  return {
    envelopeId: envelope.bulkMutationEnvelopeId,
    sequence: Number(envelope.sequence),
    status: envelope.status,
    applied: false,
    summary: { entity: envelope.entityCode, operation: request.operation, records: envelope.recordCount },
    dryRun,
  };
}

function parseStoredEnvelope(envelope: BulkMutationEnvelope): Exclude<ParsedBulkRequest, { operation: "FETCH" }> {
  const method = envelope.operation === "CREATE" ? "POST" : envelope.operation === "UPDATE" ? "PUT" : "DELETE";
  const parsed = parseBulkRequest(method, envelope.payload);
  if (parsed.operation === "FETCH") throw new Error("A queued mutation cannot contain FETCH.");
  return parsed;
}

async function applyOccupation(request: Exclude<ParsedBulkRequest, { operation: "FETCH" }>, transaction: Prisma.TransactionClient) {
  if (request.operation === "INSERT") {
    for (const record of request.payload.records) {
      await transaction.occupation.create({ data: {
        occupationId: record.key,
        name: record.name,
        affinities: { create: record.attributeAffinity.map((abilityType, ordinal) => ({ abilityType, ordinal })) },
      } });
    }
  } else if (request.operation === "UPDATE") {
    for (const record of request.payload.records) {
      await transaction.occupation.update({ where: { occupationId: record.match.key }, data: {
        active: record.set.active,
        name: record.set.name,
        ...(record.set.attributeAffinity ? { affinities: {
          deleteMany: {},
          create: record.set.attributeAffinity.map((abilityType, ordinal) => ({ abilityType, ordinal })),
        } } : {}),
      } });
    }
  } else {
    for (const record of request.payload.records) await transaction.occupation.delete({ where: { occupationId: record.match.key } });
  }
}

const nonTerminalStatuses = ["RECEIVED", "DRY_RUN_RUNNING", "DRY_RUN_FAILED", "PENDING_REVIEW", "APPLYING", "REVALIDATION_FAILED"] as const;

export async function decideBulkEnvelope(
  envelopeId: string,
  actorUserId: string,
  decision: "APPLY" | "DELETE",
  database: PrismaClient = getDatabase(),
  now = new Date(),
) {
  return database.$transaction(async (transaction) => {
    const head = await transaction.bulkMutationEnvelope.findFirst({ orderBy: { sequence: "asc" }, where: { status: { in: [...nonTerminalStatuses] } } });
    if (!head || head.bulkMutationEnvelopeId !== envelopeId) throw new Error("Only the earliest non-terminal bulk envelope is actionable.");
    if (decision === "DELETE") {
      const deleted = await transaction.bulkMutationEnvelope.update({ where: { bulkMutationEnvelopeId: envelopeId }, data: { decidedAt: now, decidedByUserId: actorUserId, status: "DELETED" } });
      await transaction.bulkOperationAudit.create({ data: { actorUserId, bulkMutationEnvelopeId: envelopeId, bulkOperationAuditId: randomUUID(), detail: "Deleted from the ordered review queue.", entityName: head.entityCode, operation: head.operation, recordCount: head.recordCount, result: "UNCHANGED" } });
      return deleted;
    }
    await transaction.bulkMutationEnvelope.update({ where: { bulkMutationEnvelopeId: envelopeId }, data: { status: "APPLYING" } });
    const request = parseStoredEnvelope(head);
    const existingKeys = request.operation === "INSERT"
      ? request.payload.records.map((record) => record.key)
      : request.payload.records.map((record) => record.match.key);
    const existing = await transaction.occupation.findMany({ select: { occupationId: true }, where: { occupationId: { in: existingKeys } } });
    const existingSet = new Set(existing.map((row) => row.occupationId));
    const errors = request.operation === "INSERT" ? existingKeys.filter((key) => existingSet.has(key)).map((key) => `Occupation ${key} already exists.`) : existingKeys.filter((key) => !existingSet.has(key)).map((key) => `Occupation ${key} does not exist.`);
    if (errors.length) {
      return transaction.bulkMutationEnvelope.update({ where: { bulkMutationEnvelopeId: envelopeId }, data: { revalidationResult: { valid: false, errors }, status: "REVALIDATION_FAILED" } });
    }
    await applyOccupation(request, transaction);
    await transaction.bulkOperationAudit.create({ data: { actorUserId, bulkMutationEnvelopeId: envelopeId, bulkOperationAuditId: randomUUID(), detail: "Applied atomically after fresh revalidation.", entityName: head.entityCode, operation: head.operation, recordCount: head.recordCount, result: "CHANGED" } });
    return transaction.bulkMutationEnvelope.update({ where: { bulkMutationEnvelopeId: envelopeId }, data: { decidedAt: now, decidedByUserId: actorUserId, revalidationResult: { valid: true, errors: [] }, status: "APPLIED" } });
  }, { isolationLevel: "Serializable" });
}

export async function handleExternalBulkRequest(request: Request, method: "DELETE" | "GET" | "POST" | "PUT", database: PrismaClient = getDatabase()) {
  const access = await authenticateExternalBulkApi(request, database);
  let parsed: ParsedBulkRequest;
  if (method === "GET") {
    const url = new URL(request.url);
    const entity = url.searchParams.get("entity");
    const limit = Number(url.searchParams.get("limit") ?? "100");
    parsed = parseBulkRequest("POST", { version: "1", operation: "FETCH", entity, notes: "Connector GET fetch", select: ["key", "name", "attributeAffinity", "active"], limit });
  } else {
    parsed = parseBulkRequest(method, await request.json());
  }
  if (parsed.operation === "FETCH") {
    if (access.mode === "KEYLESS" && !bulkEntityAdapters.occupation.allowKeylessFetch) throw new Response("This projection is not available in KEYLESS mode.", { status: 403 });
    const records = await fetchBulkOccupations(parsed, database);
    await recordBulkOperation({ database, entityName: parsed.payload.entity, externalBulkApiSessionId: access.externalBulkApiSessionId, operation: "QUERY", recordCount: records.length, result: "UNCHANGED" });
    return { entity: parsed.payload.entity, records };
  }
  return queueBulkMutation(parsed, access, database);
}
