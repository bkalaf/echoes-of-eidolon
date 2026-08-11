import contractData from "../data/entity-admin-contract.json";
import { entityForPath, type EntityName } from "../content/entities";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { CanonicalImportDriftError, UnsupportedImportEntityError } from "./import-errors";

export interface EntityAdminField {
  enumValues: string[];
  hasDefault: boolean;
  isList: boolean;
  isRequired: boolean;
  kind: "enum" | "json" | "scalar";
  name: string;
  type: string;
}

export interface EntityAdminContract {
  delegate: string;
  fields: EntityAdminField[];
  idField: string;
}

interface EntityDelegate {
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  delete(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>>;
  findMany(args: { orderBy: Record<string, "asc">; take: number }): Promise<Record<string, unknown>[]>;
  findUnique(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
  update(args: { data: Record<string, unknown>; where: Record<string, unknown> }): Promise<Record<string, unknown>>;
}

const contracts = contractData.entities as Record<string, EntityAdminContract>;

export class EntityAdminValidationError extends Error {
  override name = "EntityAdminValidationError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function entityAdminContract(entity: EntityName): EntityAdminContract {
  const contract = contracts[entity];
  if (!contract) throw new UnsupportedImportEntityError(`Generic authoring is unavailable for ${entity}.`);
  return contract;
}

export function entityForAdminKey(entityKey: string): EntityName {
  const entity = entityForPath(`/admin/data/${entityKey}`);
  if (!entity) throw new UnsupportedImportEntityError(`Unknown entity key ${entityKey}.`);
  return entity;
}

function delegateFor(database: unknown, contract: EntityAdminContract): EntityDelegate {
  const delegate = (database as unknown as Record<string, unknown>)[contract.delegate];
  if (!isRecord(delegate)) throw new UnsupportedImportEntityError(`Repository delegate ${contract.delegate} is unavailable.`);
  return delegate as unknown as EntityDelegate;
}

function normalizeScalar(field: EntityAdminField, value: unknown): unknown {
  if (value === null) {
    if (field.isRequired && !field.hasDefault) throw new EntityAdminValidationError(`${field.name} is required.`);
    return null;
  }
  if (field.isList) {
    if (!Array.isArray(value)) throw new EntityAdminValidationError(`${field.name} must be an array.`);
    return value.map((item) => normalizeScalar({ ...field, isList: false }, item));
  }
  if (field.kind === "json") {
    if (value === undefined) return value;
    return value === null ? Prisma.JsonNull : value;
  }
  if (field.kind === "enum") {
    if (typeof value !== "string" || !field.enumValues.includes(value)) {
      throw new EntityAdminValidationError(`${field.name} must be one of ${field.enumValues.join(", ")}.`);
    }
    return value;
  }
  if (["Int", "Float", "Decimal", "BigInt"].includes(field.type)) {
    const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    if (!Number.isFinite(numeric) || (field.type === "Int" && !Number.isInteger(numeric))) throw new EntityAdminValidationError(`${field.name} must be a valid ${field.type}.`);
    return field.type === "BigInt" ? BigInt(numeric) : numeric;
  }
  if (field.type === "Boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new EntityAdminValidationError(`${field.name} must be true or false.`);
  }
  if (field.type === "DateTime") {
    if (typeof value !== "string" && !(value instanceof Date)) throw new EntityAdminValidationError(`${field.name} must be an ISO date/time.`);
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.valueOf())) throw new EntityAdminValidationError(`${field.name} must be an ISO date/time.`);
    return date;
  }
  if (typeof value !== "string") throw new EntityAdminValidationError(`${field.name} must be a string.`);
  if (field.isRequired && !value.trim()) throw new EntityAdminValidationError(`${field.name} cannot be empty.`);
  return value;
}

export function normalizeEntityData(entity: EntityName, value: unknown, mode: "create" | "update"): Record<string, unknown> {
  if (!isRecord(value)) throw new EntityAdminValidationError(`${entity} data must be an object.`);
  const contract = entityAdminContract(entity);
  const allowed = new Set(contract.fields.map(({ name }) => name));
  const unknownFields = Object.keys(value).filter((field) => !allowed.has(field));
  if (unknownFields.length) throw new EntityAdminValidationError(`Unknown ${entity} fields: ${unknownFields.join(", ")}.`);
  const normalized: Record<string, unknown> = {};
  for (const field of contract.fields) {
    const input = value[field.name];
    if (input === undefined || input === "") {
      if (mode === "create" && field.isRequired && !field.hasDefault) throw new EntityAdminValidationError(`${field.name} is required.`);
      if (input === "" && !field.isRequired) normalized[field.name] = null;
      continue;
    }
    normalized[field.name] = normalizeScalar(field, input);
  }
  return normalized;
}

function whereFor(contract: EntityAdminContract, recordId: string): Record<string, unknown> {
  if (!recordId.trim()) throw new EntityAdminValidationError("A record identity is required.");
  return { [contract.idField]: recordId };
}

export async function listEntityRecords(database: PrismaClient, entity: EntityName): Promise<Record<string, unknown>[]> {
  const contract = entityAdminContract(entity);
  return delegateFor(database, contract).findMany({ orderBy: { [contract.idField]: "asc" }, take: 500 });
}

export async function getEntityRecord(database: PrismaClient, entity: EntityName, recordId: string): Promise<Record<string, unknown> | null> {
  const contract = entityAdminContract(entity);
  return delegateFor(database, contract).findUnique({ where: whereFor(contract, recordId) });
}

export async function createEntityRecord(database: PrismaClient, entity: EntityName, input: unknown): Promise<Record<string, unknown>> {
  const contract = entityAdminContract(entity);
  return delegateFor(database, contract).create({ data: normalizeEntityData(entity, input, "create") });
}

export async function updateEntityRecord(database: PrismaClient, entity: EntityName, recordId: string, input: unknown): Promise<Record<string, unknown>> {
  const contract = entityAdminContract(entity);
  const data = normalizeEntityData(entity, input, "update");
  if (data[contract.idField] !== undefined && data[contract.idField] !== recordId) throw new EntityAdminValidationError(`${contract.idField} is immutable.`);
  delete data[contract.idField];
  return delegateFor(database, contract).update({ data, where: whereFor(contract, recordId) });
}

export async function deleteEntityRecord(database: PrismaClient, entity: EntityName, recordId: string): Promise<Record<string, unknown>> {
  const contract = entityAdminContract(entity);
  return delegateFor(database, contract).delete({ where: whereFor(contract, recordId) });
}

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function sameCanonicalFields(existing: Record<string, unknown>, proposed: Record<string, unknown>, fields: EntityAdminField[]): boolean {
  return fields.every(({ name }) => JSON.stringify(canonical(existing[name])) === JSON.stringify(canonical(proposed[name])));
}

export async function applyGenericEntityImport(rows: unknown[], entity: EntityName, database: PrismaClient): Promise<{ changed: number; unchanged: number }> {
  if (!rows.length) throw new EntityAdminValidationError("Import requires at least one row.");
  const contract = entityAdminContract(entity);
  const normalized = rows.map((row) => normalizeEntityData(entity, row, "create"));
  const identities = normalized.map((row) => row[contract.idField]);
  if (new Set(identities).size !== identities.length) throw new EntityAdminValidationError(`Import duplicates ${contract.idField}.`);
  return database.$transaction(async (transaction) => {
    const delegate = delegateFor(transaction, contract);
    let changed = 0;
    let unchanged = 0;
    for (const row of normalized) {
      const identity = row[contract.idField];
      if (typeof identity !== "string") throw new EntityAdminValidationError(`${contract.idField} must be a string.`);
      const existing = await delegate.findUnique({ where: { [contract.idField]: identity } });
      if (!existing) {
        await delegate.create({ data: row });
        changed += 1;
      } else if (sameCanonicalFields(existing, row, contract.fields)) {
        unchanged += 1;
      } else {
        throw new CanonicalImportDriftError(`${entity} ${identity} conflicts with authoritative persisted data.`);
      }
    }
    return { changed, unchanged };
  });
}
