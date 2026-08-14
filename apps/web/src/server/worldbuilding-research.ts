import { createHash } from "node:crypto";
import { z } from "zod";

import { BREED_GROUPS, WORLD_BUILDING_ENUMS, validateBreed, validateTaxonomy, type BreedGroupId, type SpeciesKind } from "../domain/worldbuilding";

export const WORLD_BUILDING_RESEARCH_SCHEMA_VERSION = "eidolon-worldbuilding-research-v3-simple" as const;
export const worldbuildingResearchStatuses = ["RESEARCH_COMPLETE_IMPORTABLE", "RESEARCH_COMPLETE_BLOCKED", "REVIEW_REQUIRED", "CONFLICTING_SOURCES", "NOT_FOUND"] as const;
const statusSchema = z.enum(worldbuildingResearchStatuses);
const refSchema = z.string().trim().min(1);
const recordSchema = z.object({
  recordKey: refSchema,
  kind: z.enum(["SPECIES", "CULTURE", "BREED"]),
  speciesRef: refSchema.optional(),
  cultureRef: refSchema.optional(),
  breedRef: refSchema.optional(),
  status: statusSchema,
  data: z.record(z.string(), z.unknown()),
  evidence: z.array(z.unknown()).optional(),
}).strict();
const envelopeSchema = z.object({
  entity: z.literal("worldbuilding-research"),
  schemaVersion: z.literal(WORLD_BUILDING_RESEARCH_SCHEMA_VERSION),
  records: z.array(recordSchema).min(1).max(1_000),
}).strict();
export type WorldbuildingResearchEnvelope = z.infer<typeof envelopeSchema>;
export type WorldbuildingResearchStatus = z.infer<typeof statusSchema>;

export interface WorldbuildingImportIdAllocator {
  allocate(entity: "SPECIES" | "CULTURE" | "BREED", recordKey: string): string;
}

export function parseWorldbuildingResearchEnvelope(value: unknown): WorldbuildingResearchEnvelope {
  const envelope = envelopeSchema.parse(value);
  const keys = new Set<string>();
  for (const record of envelope.records) {
    if (keys.has(record.recordKey)) throw new Error(`WorldBuilding research duplicates recordKey ${record.recordKey}.`);
    keys.add(record.recordKey);
    const ownedRef = record.kind === "SPECIES" ? record.speciesRef : record.kind === "CULTURE" ? record.cultureRef : record.breedRef;
    if (ownedRef !== record.recordKey) throw new Error(`${record.kind} recordKey must equal its owned stable reference.`);
  }
  return envelope;
}

function nonblank(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function missingRequired(record: WorldbuildingResearchEnvelope["records"][number], personalityIds: ReadonlySet<string>, parentSpeciesKind?: SpeciesKind): string[] {
  const data = record.data;
  const missing: string[] = [];
  if (!nonblank(data.name)) missing.push("name");
  if (record.kind === "SPECIES") {
    for (const field of ["speciesKind", "originMode", "reproductiveMethod", "longevityClass", "mortalityMode", "soulDisposition", "continuityGroup", "continuityPropagationMode"]) if (!nonblank(data[field])) missing.push(field);
    if (data.taxonomy != null) missing.push(...validateTaxonomy(data.taxonomy).map((error) => `taxonomy:${error}`));
  } else if (record.kind === "CULTURE") {
    if (!nonblank(data.culturePoolId)) missing.push("culturePoolId");
  } else {
    if (!nonblank(data.groupId) || !BREED_GROUPS[data.groupId as BreedGroupId]) missing.push("groupId");
    const group = nonblank(data.groupId) ? BREED_GROUPS[data.groupId as BreedGroupId] : undefined;
    if (group?.speciesKind !== "PET" && (!nonblank(data.personalityId) || !personalityIds.has(data.personalityId))) missing.push("personalityId");
    for (const [field, allowed] of [["foodBroad", WORLD_BUILDING_ENUMS.FoodBroadCategory], ["foodSpecific", WORLD_BUILDING_ENUMS.FoodSpecific], ["terrainBroad", WORLD_BUILDING_ENUMS.TerrainBroad], ["terrainSpecific", WORLD_BUILDING_ENUMS.SpecificTerrain]] as const) {
      if (!Array.isArray(data[field]) || data[field].some((value) => typeof value !== "string" || !new Set<string>(allowed).has(value))) missing.push(field);
    }
    if (group && parentSpeciesKind) missing.push(...validateBreed({
      ...(data as Parameters<typeof validateBreed>[0]),
      speciesKind: parentSpeciesKind,
      groupId: group.groupId,
      cultureId: record.cultureRef ?? null,
      personalityId: nonblank(data.personalityId) ? data.personalityId : null,
      foodBroad: Array.isArray(data.foodBroad) ? data.foodBroad as string[] : [],
      foodSpecific: Array.isArray(data.foodSpecific) ? data.foodSpecific as string[] : [],
      terrainBroad: Array.isArray(data.terrainBroad) ? data.terrainBroad as string[] : [],
      terrainSpecific: Array.isArray(data.terrainSpecific) ? data.terrainSpecific as string[] : [],
    }, { personalityIds }).map((error) => `breed:${error}`));
  }
  return [...new Set(missing)];
}

export function classifyWorldbuildingResearch(envelope: WorldbuildingResearchEnvelope, context: { existingRefs: ReadonlySet<string>; personalityIds: ReadonlySet<string>; speciesKindsByRef?: Readonly<Record<string, SpeciesKind>> }) {
  const rows = envelope.records.map((record) => ({ ...record, issues: [] as string[] }));
  const available = new Set(context.existingRefs);
  const importableClosure: string[] = [];
  for (const kind of ["SPECIES", "CULTURE", "BREED"] as const) {
    for (const row of rows.filter((candidate) => candidate.kind === kind)) {
      if (row.status !== "RESEARCH_COMPLETE_IMPORTABLE") continue;
      const stagedSpecies = row.speciesRef ? rows.find((candidate) => candidate.kind === "SPECIES" && candidate.recordKey === row.speciesRef) : undefined;
      const parentSpeciesKind = stagedSpecies?.data.speciesKind as SpeciesKind | undefined ?? (row.speciesRef ? context.speciesKindsByRef?.[row.speciesRef] : undefined);
      const missing = missingRequired(row, context.personalityIds, parentSpeciesKind);
      if (row.speciesRef && row.speciesRef !== row.recordKey && !available.has(row.speciesRef)) missing.push(`dependency:${row.speciesRef}`);
      if (row.cultureRef && row.cultureRef !== row.recordKey && !available.has(row.cultureRef)) missing.push(`dependency:${row.cultureRef}`);
      if (missing.length) {
        row.status = "RESEARCH_COMPLETE_BLOCKED";
        row.issues.push(...missing);
      } else {
        importableClosure.push(row.recordKey);
        available.add(row.recordKey);
      }
    }
  }
  return { rows, importableClosure };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function bindWorldbuildingResearchReview(
  envelope: WorldbuildingResearchEnvelope,
  classified: ReturnType<typeof classifyWorldbuildingResearch>,
  allocator: WorldbuildingImportIdAllocator,
  reviewedIdMap: Readonly<Record<string, string>> = {},
) {
  const idMap: Record<string, string> = {};
  const stagedKeys = new Set(envelope.records.map((record) => record.recordKey));
  const externalDependencyRefs = new Set(
    envelope.records.flatMap((record) => [record.speciesRef, record.cultureRef])
      .filter((reference): reference is string => Boolean(reference) && !stagedKeys.has(reference!)),
  );
  for (const reference of externalDependencyRefs) {
    if (reviewedIdMap[reference]) idMap[reference] = reviewedIdMap[reference];
  }
  for (const recordKey of classified.importableClosure) {
    const row = classified.rows.find((candidate) => candidate.recordKey === recordKey)!;
    idMap[recordKey] = reviewedIdMap[recordKey] ?? allocator.allocate(row.kind, recordKey);
  }
  const digest = createHash("sha256").update(canonical({ envelope, idMap })).digest("hex");
  return { digest, idMap };
}

interface WorldbuildingResearchDelegate {
  findUnique(input: { where: Record<string, string> }): Promise<Record<string, unknown> | null>;
  create(input: { data: Record<string, unknown> }): Promise<unknown>;
}
interface WorldbuildingResearchTransaction {
  species: WorldbuildingResearchDelegate;
  culture: WorldbuildingResearchDelegate;
  breed: WorldbuildingResearchDelegate;
}
export interface WorldbuildingResearchDatabase {
  $transaction<Result>(work: (transaction: WorldbuildingResearchTransaction) => Promise<Result>): Promise<Result>;
}

function persistenceData(row: ReturnType<typeof classifyWorldbuildingResearch>["rows"][number], idMap: Readonly<Record<string, string>>): Record<string, unknown> {
  const id = idMap[row.recordKey];
  if (!id) throw new Error(`Reviewed idMap has no persistence ID for ${row.recordKey}.`);
  const data = row.data;
  if (row.kind === "SPECIES") return {
    speciesId: id,
    name: data.name,
    speciesKind: data.speciesKind,
    scientificName: data.scientificName ?? null,
    taxonomy: data.taxonomy ?? undefined,
    traits: data.traits ?? [],
    accent: data.accent ?? null,
    anthropomorphization: data.anthropomorphization ?? null,
    appearance: data.appearance ?? null,
    clothing: data.clothing ?? null,
    architecture: data.architecture ?? null,
    originMode: data.originMode,
    reproductiveMethod: data.reproductiveMethod,
    juvenileStages: data.juvenileStages ?? [],
    nurseryMode: data.nurseryMode ?? [],
    longevityClass: data.longevityClass,
    mortalityMode: data.mortalityMode,
    soulDisposition: data.soulDisposition,
    continuityGroup: data.continuityGroup,
    continuityPropagationMode: data.continuityPropagationMode,
  };
  if (row.kind === "CULTURE") return {
    cultureId: id,
    culturePoolId: data.culturePoolId,
    name: data.name,
    appearance: data.appearance ?? null,
    clothing: data.clothing ?? null,
    architecture: data.architecture ?? null,
  };
  const speciesId = row.speciesRef ? idMap[row.speciesRef] : undefined;
  const cultureId = row.cultureRef ? idMap[row.cultureRef] : null;
  if (!speciesId) throw new Error(`Reviewed idMap cannot resolve Species dependency ${row.speciesRef ?? "missing"}.`);
  if (row.cultureRef && !cultureId) throw new Error(`Reviewed idMap cannot resolve Culture dependency ${row.cultureRef}.`);
  return {
    breedId: id,
    name: data.name,
    speciesId,
    cultureId,
    groupId: data.groupId,
    personalityId: data.personalityId ?? null,
    traits: data.traits ?? [],
    accent: data.accent ?? null,
    appearance: data.appearance ?? null,
    clothing: data.clothing ?? null,
    architecture: data.architecture ?? null,
    foodBroad: data.foodBroad,
    foodSpecific: data.foodSpecific,
    terrainBroad: data.terrainBroad,
    terrainSpecific: data.terrainSpecific,
    administrationMode: data.administrationMode ?? null,
    structureOrientation: data.structureOrientation ?? null,
    operatingStyle: data.operatingStyle ?? null,
    motivation: data.motivation ?? null,
    authoritySource: data.authoritySource ?? null,
    legitimacyBasis: data.legitimacyBasis ?? null,
    allocationMode: data.allocationMode ?? null,
    ownershipMode: data.ownershipMode ?? null,
    loquacity: data.loquacity ?? null,
    emotionalTemperature: data.emotionalTemperature ?? null,
    outlookOrientation: data.outlookOrientation ?? null,
    collaborativePosture: data.collaborativePosture ?? null,
  };
}

export async function applyWorldbuildingResearchReview(
  envelope: WorldbuildingResearchEnvelope,
  classified: ReturnType<typeof classifyWorldbuildingResearch>,
  review: { digest: string; idMap: Readonly<Record<string, string>> },
  database: WorldbuildingResearchDatabase,
) {
  const rebound = bindWorldbuildingResearchReview(envelope, classified, { allocate() { throw new Error("Reviewed apply cannot allocate new IDs."); } }, review.idMap);
  if (rebound.digest !== review.digest || canonical(rebound.idMap) !== canonical(review.idMap)) throw new Error("Reviewed WorldBuilding payload or idMap drifted after review.");
  return database.$transaction(async (transaction) => {
    let applied = 0;
    let unchanged = 0;
    for (const kind of ["SPECIES", "CULTURE", "BREED"] as const) {
      for (const recordKey of classified.importableClosure) {
        const row = classified.rows.find((candidate) => candidate.recordKey === recordKey && candidate.kind === kind);
        if (!row) continue;
        const data = persistenceData(row, review.idMap);
        const idField = kind === "SPECIES" ? "speciesId" : kind === "CULTURE" ? "cultureId" : "breedId";
        const delegate = kind === "SPECIES" ? transaction.species : kind === "CULTURE" ? transaction.culture : transaction.breed;
        const existing = await delegate.findUnique({ where: { [idField]: String(data[idField]) } });
        if (!existing) {
          await delegate.create({ data });
          applied += 1;
        } else if (canonical(Object.fromEntries(Object.keys(data).map((key) => [key, existing[key]]))) === canonical(data)) {
          unchanged += 1;
        } else {
          throw new Error(`${kind} ${recordKey} conflicts with persisted canonical data.`);
        }
      }
    }
    return { applied, unchanged, retainedBlocked: classified.rows.length - classified.importableClosure.length };
  });
}
