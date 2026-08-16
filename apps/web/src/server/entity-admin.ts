import contractData from "../data/entity-admin-contract.json";
import { entityForPath, type EntityName } from "../content/entities";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { CanonicalImportDriftError, UnsupportedImportEntityError } from "./import-errors";
import { validateBreed, validateBreedHierarchy, validateCanonicalPersistenceId, validateSpecies, validateTaxonomy, type BreedHierarchyNode } from "../domain/worldbuilding";
import { staticPresentationQa, type PresentationField } from "../domain/presentation-audit";
import { assertCanonicalCharacterBreedPolicy, canonicalCharacterId } from "../domain/architect-witness";
import { assertWitnessArchitectSoulContinuity, witnessDefSchema } from "../domain/invariants";
import { assertPersistedWitnessArchitectSoulContinuity } from "./architect-witness-import";

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
  auditFields: Array<{ editability: "EDITABLE" | "EXCLUDED"; exclusionReason: string | null; enumName: string | null; isList: boolean; isRequired: boolean; kind: "enum" | "json" | "relation" | "scalar"; name: string; type: string }>;
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

async function validateWorldbuildingWrite(database: PrismaClient, entity: EntityName, data: Record<string, unknown>): Promise<void> {
  if (entity === "Species" || entity === "Culture" || entity === "Breed") {
    const idField = entity === "Species" ? "speciesId" : entity === "Culture" ? "cultureId" : "breedId";
    const kind = entity === "Species" ? "SPECIES" : entity === "Culture" ? "CULTURE" : "BREED";
    if (typeof data.name !== "string" || !data.name.trim()) throw new EntityAdminValidationError(`${entity} name is required.`);
    const idErrors = validateCanonicalPersistenceId(kind, data[idField]);
    if (idErrors.length) throw new EntityAdminValidationError(idErrors.join(" "));
    const presentationFields: PresentationField[] = entity === "Culture" ? ["appearance", "clothing", "architecture"] : ["accent", "appearance", "clothing", "architecture"];
    const presentationErrors = presentationFields.flatMap((field) => typeof data[field] === "string" && data[field].trim() ? staticPresentationQa(field, data[field]).failures : []);
    if (presentationErrors.length) throw new EntityAdminValidationError(presentationErrors.join(" "));
  }
  if (entity === "Species") {
    const errors = [
      ...(data.taxonomy != null ? validateTaxonomy(data.taxonomy) : []),
      ...validateSpecies(data as unknown as Parameters<typeof validateSpecies>[0]),
    ];
    if (errors.length) throw new EntityAdminValidationError(errors.join(" "));
    return;
  }
  if (entity === "Culture") return;
  if (entity !== "Breed") return;
  const speciesId = data.speciesId;
  if (typeof speciesId !== "string") throw new EntityAdminValidationError("speciesId is required.");
  const species = await database.species.findUnique({ select: { speciesKind: true }, where: { speciesId } });
  if (!species) throw new EntityAdminValidationError(`Species ${speciesId} does not exist.`);
  const personalityId = typeof data.personalityId === "string" ? data.personalityId : null;
  const personalityIds = new Set<string>();
  if (personalityId && await database.personalityExpression.findUnique({ select: { personalityId: true }, where: { personalityId } })) personalityIds.add(personalityId);
  const errors = validateBreed({
    ...(data as unknown as Parameters<typeof validateBreed>[0]),
    speciesKind: species.speciesKind,
    foodBroad: Array.isArray(data.foodBroad) ? data.foodBroad as string[] : [],
    foodSpecific: Array.isArray(data.foodSpecific) ? data.foodSpecific as string[] : [],
    terrainBroad: Array.isArray(data.terrainBroad) ? data.terrainBroad as string[] : [],
    terrainSpecific: Array.isArray(data.terrainSpecific) ? data.terrainSpecific as string[] : [],
    groupId: String(data.groupId ?? ""), personalityId,
  }, { personalityIds });
  const breedId = typeof data.breedId === "string" ? data.breedId : "";
  const parentBreedId = typeof data.parentBreedId === "string" && data.parentBreedId.trim() ? data.parentBreedId : null;
  if (parentBreedId) {
    const parent = await database.breed.findUnique({ select: { breedId: true, speciesId: true, populationKind: true, parentBreedId: true }, where: { breedId: parentBreedId } });
    errors.push(...validateBreedHierarchy({ breedId, speciesId, populationKind: data.populationKind as BreedHierarchyNode["populationKind"], parentBreedId }, parent));
    const visited = new Set<string>([breedId]);
    let ancestor = parent;
    while (ancestor) {
      if (visited.has(ancestor.breedId)) { errors.push(`Breed hierarchy cycle detected for ${breedId}.`); break; }
      visited.add(ancestor.breedId);
      ancestor = ancestor.parentBreedId
        ? await database.breed.findUnique({ select: { breedId: true, speciesId: true, populationKind: true, parentBreedId: true }, where: { breedId: ancestor.parentBreedId } })
        : null;
    }
  }
  if (breedId) {
    const children = await database.breed.findMany({ select: { breedId: true, speciesId: true, populationKind: true, parentBreedId: true }, where: { parentBreedId: breedId } });
    const proposed = { breedId, speciesId, populationKind: data.populationKind as BreedHierarchyNode["populationKind"], parentBreedId };
    for (const child of children) errors.push(...validateBreedHierarchy(child, proposed));
  }
  if (errors.length) throw new EntityAdminValidationError(errors.join(" "));
}

const presidingArchitectIds = new Set([
  canonicalCharacterId("Hans Halycon Hohenzollern"),
  canonicalCharacterId("Noell Pieter Smukk"),
]);

async function validateCharacterSubtypeWrite(database: PrismaClient, entity: EntityName, data: Record<string, unknown>): Promise<void> {
  const enforceBreedPolicy = (character: { characterId: string; breedId?: string | null }) => {
    try { assertCanonicalCharacterBreedPolicy(character); }
    catch (error) { throw new EntityAdminValidationError(error instanceof Error ? error.message : String(error)); }
  };
  if (entity === "Architect") {
    const characterId = String(data.characterId ?? "");
    const department = data.department ?? null;
    if ((presidingArchitectIds.has(characterId) && department !== null) || (!presidingArchitectIds.has(characterId) && department === null)) {
      throw new EntityAdminValidationError("Only Hans and Noell are presiding Architects with no department.");
    }
    const character = await database.character.findUnique({ select: { characterId: true, breedId: true }, where: { characterId } });
    if (!character) throw new EntityAdminValidationError(`Architect Character ${characterId} does not exist.`);
    enforceBreedPolicy(character);
    return;
  }
  if (entity === "Witness") {
    const characterId = String(data.characterId ?? "");
    const architectCharacterId = String(data.architectCharacterId ?? "");
    const witnessDefId = String(data.witnessDefId ?? "");
    const [witnessCharacter, sourceArchitect] = await Promise.all([
      database.character.findUnique({ select: { characterId: true, breedId: true }, where: { characterId } }),
      database.architect.findUnique({ include: { character: { select: { characterId: true, breedId: true } } }, where: { characterId: architectCharacterId } }),
    ]);
    if (!witnessCharacter) throw new EntityAdminValidationError(`Witness Character ${characterId} does not exist.`);
    enforceBreedPolicy(witnessCharacter);
    if (sourceArchitect) enforceBreedPolicy(sourceArchitect.character);
    await assertPersistedWitnessArchitectSoulContinuity(database, { architectCharacterId, witnessCharacterId: characterId, witnessDefId });
    const [architect, witnessDef] = await Promise.all([
      database.architect.findUnique({ select: { department: true }, where: { characterId: architectCharacterId } }),
      database.witnessDef.findUnique({ select: { department: true }, where: { witnessDefId } }),
    ]);
    if (!witnessDef) throw new EntityAdminValidationError(`WitnessDef ${witnessDefId} does not exist.`);
    if (architect?.department !== witnessDef.department) throw new EntityAdminValidationError("WitnessDef department must match the source Architect department.");
    return;
  }
  if (entity === "Companion") {
    const characterId = String(data.characterId ?? "");
    const character = await database.character.findUnique({ select: { characterId: true, breedId: true }, where: { characterId } });
    if (!character) throw new EntityAdminValidationError(`Companion Character ${characterId} does not exist.`);
    enforceBreedPolicy(character);
    return;
  }
  if (entity === "Character" && typeof data.characterId === "string") {
    const existing = await database.character.findUnique({
      include: {
        witness: { include: { architect: { include: { character: true } } } },
        architect: { include: { witnesses: { include: { character: true } } } },
      },
      where: { characterId: data.characterId },
    });
    enforceBreedPolicy({ characterId: data.characterId, breedId: data.breedId as string | null | undefined });
    if (!existing) return;
    const proposed = { characterId: existing.characterId, soulId: data.soulId === undefined ? existing.soulId : data.soulId as string | null };
    if (existing.witness) {
      try { assertWitnessArchitectSoulContinuity(proposed, existing.witness.architect.character); }
      catch { throw new EntityAdminValidationError("Witness and source Architect must reference the same Soul."); }
    }
    for (const witness of existing.architect?.witnesses ?? []) {
      try { assertWitnessArchitectSoulContinuity(witness.character, proposed); }
      catch { throw new EntityAdminValidationError("Witness and source Architect must reference the same Soul."); }
    }
    return;
  }
  if (entity === "WitnessDef" && typeof data.witnessDefId === "string") {
    const parsed = witnessDefSchema.safeParse(data);
    if (!parsed.success) throw new EntityAdminValidationError(parsed.error.issues.map(({ message }) => message).join(" "));
    if (!await database.soul.findUnique({ select: { soulId: true }, where: { soulId: parsed.data.architectSoulId } })) {
      throw new EntityAdminValidationError(`Architect Soul ${parsed.data.architectSoulId} does not exist.`);
    }
    const existing = await database.witnessDef.findUnique({
      include: { witnesses: { include: { architect: { include: { character: true } } } } },
      where: { witnessDefId: data.witnessDefId },
    });
    const department = data.department ?? existing?.department;
    if (existing?.witnesses.some(({ architect }) => architect.department !== department)) throw new EntityAdminValidationError("WitnessDef department must match every source Architect department.");
    if (existing?.witnesses.some(({ architect }) => architect.character.soulId !== parsed.data.architectSoulId)) throw new EntityAdminValidationError("WitnessDef and every source Architect must reference the same Soul.");
  }
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
  const data = normalizeEntityData(entity, input, "create");
  await validateWorldbuildingWrite(database, entity, data);
  await validateCharacterSubtypeWrite(database, entity, data);
  return delegateFor(database, contract).create({ data });
}

export async function updateEntityRecord(database: PrismaClient, entity: EntityName, recordId: string, input: unknown): Promise<Record<string, unknown>> {
  const contract = entityAdminContract(entity);
  const data = normalizeEntityData(entity, input, "update");
  if (data[contract.idField] !== undefined && data[contract.idField] !== recordId) throw new EntityAdminValidationError(`${contract.idField} is immutable.`);
  delete data[contract.idField];
  if (entity === "Species" || entity === "Culture" || entity === "Breed") {
    const existing = await getEntityRecord(database, entity, recordId);
    if (!existing) throw new EntityAdminValidationError(`${entity} record not found.`);
    await validateWorldbuildingWrite(database, entity, { ...existing, ...data });
  }
  if (["Character", "Architect", "Witness", "WitnessDef"].includes(entity)) {
    const existing = await getEntityRecord(database, entity, recordId);
    if (!existing) throw new EntityAdminValidationError(`${entity} record not found.`);
    await validateCharacterSubtypeWrite(database, entity, { ...existing, ...data, [contract.idField]: recordId });
  }
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
  return fields.every((field) => JSON.stringify(canonical(existing[field.name])) === JSON.stringify(canonical(proposed[field.name] === undefined && !field.isRequired ? null : proposed[field.name])));
}

function differingCanonicalFields(existing: Record<string, unknown>, proposed: Record<string, unknown>, fields: EntityAdminField[]): string[] {
  return fields.filter((field) => JSON.stringify(canonical(existing[field.name])) !== JSON.stringify(canonical(proposed[field.name] === undefined && !field.isRequired ? null : proposed[field.name]))).map(({ name }) => name);
}

export async function applyGenericEntityImportInTransaction(rows: unknown[], entity: EntityName, database: PrismaClient): Promise<{ changed: number; unchanged: number }> {
  if (!rows.length) throw new EntityAdminValidationError("Import requires at least one row.");
  const contract = entityAdminContract(entity);
  const normalized = rows.map((row) => normalizeEntityData(entity, row, "create"));
  const identities = normalized.map((row) => row[contract.idField]);
  if (new Set(identities).size !== identities.length) throw new EntityAdminValidationError(`Import duplicates ${contract.idField}.`);
  const delegate = delegateFor(database, contract);
  let changed = 0;
  let unchanged = 0;
  for (const row of normalized) {
    const identity = row[contract.idField];
    if (typeof identity !== "string") throw new EntityAdminValidationError(`${contract.idField} must be a string.`);
    try {
      await validateWorldbuildingWrite(database, entity, row);
      await validateCharacterSubtypeWrite(database, entity, row);
    } catch (error) {
      if (error instanceof EntityAdminValidationError) throw new EntityAdminValidationError(`${entity} ${identity}: ${error.message}`);
      throw error;
    }
    const existing = await delegate.findUnique({ where: { [contract.idField]: identity } });
    if (!existing) {
      await delegate.create({ data: row });
      changed += 1;
    } else if (sameCanonicalFields(existing, row, contract.fields)) {
      unchanged += 1;
    } else {
      throw new CanonicalImportDriftError(`${entity} ${identity} conflicts with authoritative persisted data in fields: ${differingCanonicalFields(existing, row, contract.fields).join(", ")}.`);
    }
  }
  return { changed, unchanged };
}

export async function applyGenericEntityImport(rows: unknown[], entity: EntityName, database: PrismaClient): Promise<{ changed: number; unchanged: number }> {
  return database.$transaction((transaction) => applyGenericEntityImportInTransaction(rows, entity, transaction as unknown as PrismaClient));
}
