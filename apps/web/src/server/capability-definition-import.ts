import { z } from "zod";

import { Prisma, type PrismaClient } from "../generated/prisma/client";
import {
  CapabilityMonotonicPolicy,
  CapabilityOperation,
  CapabilityParameterKind,
  CapabilityValueKind,
  EntityType,
} from "../generated/prisma/enums";
import type { CapabilityValue } from "../domain/capabilities";
import {
  createCapabilityDefinitionVersionInTransaction,
  type CapabilityVersionAuthoringInput,
  validateCapabilityVersionAuthoringInput,
} from "./capability-ledger";
import { getDatabase } from "./database";
import { CanonicalImportDriftError } from "./import-errors";

const parameterSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(CapabilityParameterKind),
  entityType: z.enum(EntityType).nullable().optional(),
  allowedValues: z.array(z.string().trim().min(1)).default([]),
}).strict();

const rowSchema = z.object({
  capabilityDefinitionId: z.string().trim().min(1),
  code: z.string().trim().min(1),
  pathPattern: z.string().trim().min(1),
  valueKind: z.enum(CapabilityValueKind),
  minValue: z.number().finite().nullable().optional(),
  maxValue: z.number().finite().nullable().optional(),
  enumValues: z.array(z.string().trim().min(1)).default([]),
  allowedReferenceEntityTypes: z.array(z.enum(EntityType)).default([]),
  allowedOperations: z.array(z.enum(CapabilityOperation)).min(1),
  monotonicPolicy: z.enum(CapabilityMonotonicPolicy),
  initialValue: z.unknown().optional(),
  description: z.string().trim().min(1),
  parameters: z.array(parameterSchema).default([]),
}).strict();

export type CapabilityDefinitionImportRow = z.infer<typeof rowSchema>;

function typedInitialValue(row: CapabilityDefinitionImportRow): CapabilityValue | undefined {
  const value = row.initialValue;
  if (value === undefined || value === null) return undefined;
  if (row.valueKind === "COUNTER") {
    if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
    throw new Error(`Capability ${row.code} COUNTER initialValue must be a safe integer or integer string.`);
  }
  if (row.valueKind === "REFERENCE") {
    if (typeof value === "object" && value !== null && !Array.isArray(value)
      && typeof (value as { entityType?: unknown }).entityType === "string"
      && typeof (value as { entityId?: unknown }).entityId === "string") {
      return value as CapabilityValue;
    }
    throw new Error(`Capability ${row.code} REFERENCE initialValue must be a typed reference.`);
  }
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") return value;
  throw new Error(`Capability ${row.code} initialValue does not match ${row.valueKind}.`);
}

function authoringInput(row: CapabilityDefinitionImportRow): CapabilityVersionAuthoringInput {
  const initialValue = typedInitialValue(row);
  return {
    capabilityDefinitionId: row.capabilityDefinitionId,
    code: row.code,
    pathPattern: row.pathPattern,
    valueKind: row.valueKind,
    minValue: row.minValue,
    maxValue: row.maxValue,
    enumValues: row.enumValues,
    allowedReferenceEntityTypes: row.allowedReferenceEntityTypes,
    allowedOperations: row.allowedOperations,
    monotonicPolicy: row.monotonicPolicy,
    ...(initialValue === undefined ? {} : { initialValue }),
    description: row.description,
    parameters: row.parameters,
  };
}

export function parseCapabilityDefinitionImportRows(value: unknown): CapabilityDefinitionImportRow[] {
  const rows = z.array(rowSchema).min(1).parse(value);
  const identities = new Set<string>();
  const codes = new Set<string>();
  for (const row of rows) {
    if (identities.has(row.capabilityDefinitionId)) throw new Error(`Import duplicates capabilityDefinitionId ${row.capabilityDefinitionId}.`);
    if (codes.has(row.code)) throw new Error(`Import duplicates capability code ${row.code}.`);
    identities.add(row.capabilityDefinitionId);
    codes.add(row.code);
    validateCapabilityVersionAuthoringInput(authoringInput(row));
  }
  return rows;
}

function jsonValue(value: unknown): string {
  return JSON.stringify(value, (_key, member) => typeof member === "bigint" ? member.toString() : member);
}

function persistedInitialValue(version: {
  initialBoolean: boolean | null;
  initialScore: number | null;
  initialCounter: bigint | null;
  initialEnum: string | null;
  initialReferenceEntityType: EntityType | null;
  initialReferenceEntityId: string | null;
}): CapabilityValue | undefined {
  if (version.initialBoolean != null) return version.initialBoolean;
  if (version.initialScore != null) return version.initialScore;
  if (version.initialCounter != null) return version.initialCounter;
  if (version.initialEnum != null) return version.initialEnum;
  if (version.initialReferenceEntityType && version.initialReferenceEntityId) {
    return { entityType: version.initialReferenceEntityType, entityId: version.initialReferenceEntityId };
  }
  return undefined;
}

function matchesLatest(input: CapabilityVersionAuthoringInput, version: {
  pathPattern: string;
  valueKind: CapabilityValueKind;
  minValue: number | null;
  maxValue: number | null;
  enumValues: string[];
  allowedReferenceEntityTypes: EntityType[];
  allowedOperations: CapabilityOperation[];
  monotonicPolicy: CapabilityMonotonicPolicy;
  description: string;
  initialBoolean: boolean | null;
  initialScore: number | null;
  initialCounter: bigint | null;
  initialEnum: string | null;
  initialReferenceEntityType: EntityType | null;
  initialReferenceEntityId: string | null;
  parameters: Array<{ name: string; kind: CapabilityParameterKind; entityType: EntityType | null; allowedValues: string[]; ordinal: number }>;
}) {
  return jsonValue({
    pathPattern: version.pathPattern,
    valueKind: version.valueKind,
    minValue: version.minValue,
    maxValue: version.maxValue,
    enumValues: version.enumValues,
    allowedReferenceEntityTypes: version.allowedReferenceEntityTypes,
    allowedOperations: version.allowedOperations,
    monotonicPolicy: version.monotonicPolicy,
    initialValue: persistedInitialValue(version),
    description: version.description,
    parameters: version.parameters.map(({ name, kind, entityType, allowedValues }) => ({ name, kind, entityType, allowedValues })),
  }) === jsonValue({
    pathPattern: input.pathPattern,
    valueKind: input.valueKind,
    minValue: input.minValue ?? null,
    maxValue: input.maxValue ?? null,
    enumValues: input.enumValues ?? [],
    allowedReferenceEntityTypes: input.allowedReferenceEntityTypes ?? [],
    allowedOperations: input.allowedOperations,
    monotonicPolicy: input.monotonicPolicy,
    initialValue: input.initialValue,
    description: input.description,
    parameters: input.parameters.map(({ name, kind, entityType, allowedValues }) => ({ name, kind, entityType: entityType ?? null, allowedValues: allowedValues ?? [] })),
  });
}

export async function applyCapabilityDefinitionImport(value: unknown, database: PrismaClient = getDatabase()) {
  const rows = parseCapabilityDefinitionImportRows(value);
  return database.$transaction(async (transaction) => {
    let changed = 0;
    let unchanged = 0;
    for (const row of rows) {
      const input = authoringInput(row);
      const existing = await transaction.capabilityDefinition.findFirst({
        where: { OR: [{ capabilityDefinitionId: row.capabilityDefinitionId }, { code: row.code }] },
        include: { versions: { include: { parameters: { orderBy: { ordinal: "asc" } } }, orderBy: { version: "desc" }, take: 1 } },
      });
      if (existing && (existing.capabilityDefinitionId !== row.capabilityDefinitionId || existing.code !== row.code)) {
        throw new CanonicalImportDriftError(`Capability stable identity conflict for ${row.capabilityDefinitionId}/${row.code}.`);
      }
      const latest = existing?.versions[0];
      if (latest && matchesLatest(input, latest)) {
        unchanged += 1;
        continue;
      }
      await createCapabilityDefinitionVersionInTransaction(input, transaction);
      changed += 1;
    }
    return { changed, unchanged };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
