import { createHash } from "node:crypto";
import { z } from "zod";

import { BREED_GROUPS, WORLD_BUILDING_ENUMS, canonicalEntityId, validateBreed, validateBreedHierarchy, validateSpecies, validateTaxonomy, type BreedGroupId, type BreedHierarchyNode, type SpeciesKind } from "../domain/worldbuilding";

export const WORLD_BUILDING_RESEARCH_SCHEMA_VERSION = "eidolon-worldbuilding-research-v3-simple" as const;
export const worldbuildingResearchStatuses = ["RESOLVED", "REVIEW_REQUIRED", "CONFLICTING_SOURCES", "NOT_FOUND", "ID_COLLISION_REVIEW_REQUIRED"] as const;
export const worldbuildingImportStatuses = ["RESEARCH_COMPLETE_IMPORTABLE", "RESEARCH_COMPLETE_BLOCKED"] as const;
const researchStatusSchema = z.enum(worldbuildingResearchStatuses);
const importStatusSchema = z.enum(worldbuildingImportStatuses);
const refSchema = z.string().trim().min(1);
const recordSchema = z.object({
  recordKey: refSchema,
  kind: z.enum(["SPECIES", "CULTURE", "BREED"]),
  speciesRef: refSchema.optional(),
  cultureRef: refSchema.optional(),
  breedRef: refSchema.optional(),
  researchStatus: researchStatusSchema,
  importStatus: importStatusSchema,
  data: z.record(z.string(), z.unknown()),
  evidence: z.array(z.unknown()).optional(),
}).strict();
const envelopeSchema = z.object({
  entity: z.literal("worldbuilding-research"),
  schemaVersion: z.literal(WORLD_BUILDING_RESEARCH_SCHEMA_VERSION),
  records: z.array(recordSchema).min(1).max(1_000),
}).strict();
export type WorldbuildingResearchEnvelope = z.infer<typeof envelopeSchema>;
export type WorldbuildingResearchStatus = z.infer<typeof researchStatusSchema>;
export type WorldbuildingImportStatus = z.infer<typeof importStatusSchema>;
export type WorldbuildingResearchRecord = WorldbuildingResearchEnvelope["records"][number];

export class WorldbuildingEnvelopeLimitError extends Error {
  override name = "WorldbuildingEnvelopeLimitError";
}

function ownedId(record: WorldbuildingResearchEnvelope["records"][number]): string {
  const reference = record.kind === "SPECIES" ? record.speciesRef : record.kind === "CULTURE" ? record.cultureRef : record.breedRef;
  if (!reference) throw new Error(`${record.kind} ${record.recordKey} is missing its canonical persistence reference.`);
  return reference;
}

function ownedIdField(kind: WorldbuildingResearchEnvelope["records"][number]["kind"]): "speciesId" | "cultureId" | "breedId" {
  return kind === "SPECIES" ? "speciesId" : kind === "CULTURE" ? "cultureId" : "breedId";
}

export function parseWorldbuildingResearchEnvelope(value: unknown): WorldbuildingResearchEnvelope {
  const envelope = envelopeSchema.parse(value);
  validateRecordIdentities(envelope.records);
  return envelope;
}

function validateRecordIdentities(records: readonly WorldbuildingResearchRecord[]): void {
  const keys = new Set<string>();
  for (const record of records) {
    if (keys.has(record.recordKey)) throw new Error(`WorldBuilding research duplicates recordKey ${record.recordKey}.`);
    keys.add(record.recordKey);
    const reference = ownedId(record);
    const idField = ownedIdField(record.kind);
    if (record.data[idField] !== reference) throw new Error(`${record.kind} ${idField} and its legacy reference must contain the same canonical persistence ID.`);
    if (!nonblank(record.data.name)) throw new Error(`${record.kind} ${record.recordKey} is missing its finalized canonical name.`);
    const expected = canonicalEntityId(record.kind, record.data.name);
    if (reference !== expected) throw new Error(`${record.kind} ${record.data.name} must use canonical persistence ID ${expected}.`);
  }
}

export function buildWorldbuildingResearchEnvelopes(value: unknown, options: { maximumCanonicalRows?: number; externalRefs?: ReadonlySet<string> } = {}): WorldbuildingResearchEnvelope[] {
  const records = z.array(recordSchema).min(1).parse(value);
  validateRecordIdentities(records);
  const maximumCanonicalRows = options.maximumCanonicalRows ?? 1_000;
  if (!Number.isInteger(maximumCanonicalRows) || maximumCanonicalRows < 1 || maximumCanonicalRows > 1_000) throw new Error("maximumCanonicalRows must be an integer from 1 through 1000.");
  const externalRefs = options.externalRefs ?? new Set<string>();
  const recordById = new Map<string, WorldbuildingResearchRecord>();
  for (const record of records) {
    const id = ownedId(record);
    const existing = recordById.get(id);
    if (!existing) {
      recordById.set(id, record);
      continue;
    }
    if (existing.data.name !== record.data.name) throw new Error(`ID_COLLISION_REVIEW_REQUIRED: distinct canonical names converge on ${id}.`);
    if (canonical(existing.data) !== canonical(record.data)) throw new Error(`CONFLICTING_SOURCES: canonical entity ${id} has incompatible normalized data.`);
    const evidence = [...new Map([...(existing.evidence ?? []), ...(record.evidence ?? [])].map((entry) => [canonical(entry), entry])).values()];
    recordById.set(id, { ...existing, evidence: evidence.length ? evidence : undefined });
  }
  const adjacency = new Map([...recordById.keys()].map((id) => [id, new Set<string>()]));
  for (const record of recordById.values()) {
    if (record.kind !== "BREED") continue;
    if (!record.speciesRef) throw new Error(`DANGLING_REFERENCE: Breed ${ownedId(record)} has no Species reference.`);
    const parentBreedId = nonblank(record.data.parentBreedId) ? record.data.parentBreedId : null;
    for (const reference of [record.speciesRef, record.cultureRef, parentBreedId].filter((entry): entry is string => Boolean(entry))) {
      if (recordById.has(reference)) {
        if (reference === parentBreedId && recordById.get(reference)?.kind !== "BREED") throw new Error(`DANGLING_REFERENCE: Breed ${ownedId(record)} parent ${reference} is not a Breed.`);
        adjacency.get(ownedId(record))!.add(reference);
        adjacency.get(reference)!.add(ownedId(record));
      } else if (!externalRefs.has(reference)) {
        throw new Error(`DANGLING_REFERENCE: Breed ${ownedId(record)} references unavailable ${reference}.`);
      }
    }
  }
  const hierarchyState = new Map<string, "VISITING" | "VISITED">();
  const visitBreedHierarchy = (id: string): void => {
    if (hierarchyState.get(id) === "VISITING") throw new Error(`BREED_HIERARCHY_CYCLE: ${id} participates in a parent cycle.`);
    if (hierarchyState.get(id) === "VISITED") return;
    hierarchyState.set(id, "VISITING");
    const record = recordById.get(id);
    const parentBreedId = record?.kind === "BREED" && nonblank(record.data.parentBreedId) ? record.data.parentBreedId : null;
    if (parentBreedId && recordById.get(parentBreedId)?.kind === "BREED") visitBreedHierarchy(parentBreedId);
    hierarchyState.set(id, "VISITED");
  };
  for (const record of recordById.values()) if (record.kind === "BREED") visitBreedHierarchy(ownedId(record));
  const visited = new Set<string>();
  const components: WorldbuildingResearchRecord[][] = [];
  for (const start of recordById.keys()) {
    if (visited.has(start)) continue;
    const pending = [start];
    const componentIds: string[] = [];
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      componentIds.push(id);
      pending.push(...[...(adjacency.get(id) ?? [])].sort().reverse());
    }
    const componentRecords = componentIds.map((id) => recordById.get(id)!);
    const roots = componentRecords.filter((record) => record.kind !== "BREED").sort((left, right) => {
      const order = { SPECIES: 0, CULTURE: 1 } as const;
      return order[left.kind as keyof typeof order] - order[right.kind as keyof typeof order] || ownedId(left).localeCompare(ownedId(right));
    });
    const pendingBreeds = componentRecords.filter((record) => record.kind === "BREED");
    const orderedBreeds: WorldbuildingResearchRecord[] = [];
    const pendingIds = new Set(pendingBreeds.map(ownedId));
    while (pendingIds.size) {
      const ready = pendingBreeds.filter((record) => pendingIds.has(ownedId(record)) && (!nonblank(record.data.parentBreedId) || !pendingIds.has(record.data.parentBreedId))).sort((left, right) => ownedId(left).localeCompare(ownedId(right)));
      if (!ready.length) throw new Error("BREED_HIERARCHY_CYCLE: no parent-first Breed ordering exists.");
      for (const record of ready) { orderedBreeds.push(record); pendingIds.delete(ownedId(record)); }
    }
    const component = [...roots, ...orderedBreeds];
    if (component.length > maximumCanonicalRows) throw new WorldbuildingEnvelopeLimitError(`ENVELOPE_LIMIT_IMPLEMENTATION_BLOCKER: intact component has ${component.length} canonical rows, exceeding ${maximumCanonicalRows}.`);
    components.push(component);
  }
  const bins: WorldbuildingResearchRecord[][] = [];
  for (const component of components) {
    const bin = bins.find((candidate) => candidate.length + component.length <= maximumCanonicalRows);
    if (bin) bin.push(...component); else bins.push([...component]);
  }
  return bins.map((records) => parseWorldbuildingResearchEnvelope({ entity: "worldbuilding-research", schemaVersion: WORLD_BUILDING_RESEARCH_SCHEMA_VERSION, records }));
}

function nonblank(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function missingRequired(record: WorldbuildingResearchEnvelope["records"][number], personalityIds: ReadonlySet<string>, parentSpeciesKind?: SpeciesKind, parentBreed?: BreedHierarchyNode | null): string[] {
  const data = record.data;
  const missing: string[] = [];
  if (!nonblank(data.name)) missing.push("name");
  if (record.kind === "SPECIES") {
    for (const field of ["speciesKind", "originMode", "reproductiveMethod", "longevityClass", "mortalityMode", "soulDisposition", "continuityGroup", "continuityPropagationMode"]) if (!nonblank(data[field])) missing.push(field);
    if (data.taxonomy != null) missing.push(...validateTaxonomy(data.taxonomy).map((error) => `taxonomy:${error}`));
    missing.push(...validateSpecies(data as Parameters<typeof validateSpecies>[0]).map((error) => `species:${error}`));
  } else if (record.kind !== "CULTURE") {
    if (!nonblank(data.populationKind) || !new Set<string>(["HUMAN", "BEAST", "MYTHOS", "PET"]).has(data.populationKind)) missing.push("populationKind");
    if (!nonblank(data.groupId) || !BREED_GROUPS[data.groupId as BreedGroupId]) missing.push("groupId");
    const group = nonblank(data.groupId) ? BREED_GROUPS[data.groupId as BreedGroupId] : undefined;
    if (nonblank(data.personalityId) && !personalityIds.has(data.personalityId)) missing.push("personalityId");
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
    if (data.parentBreedId !== undefined && data.parentBreedId !== null && !nonblank(data.parentBreedId)) missing.push("parentBreedId");
    if (nonblank(data.parentBreedId) && nonblank(data.breedId) && nonblank(data.speciesId) && nonblank(data.populationKind)) {
      missing.push(...validateBreedHierarchy({
        breedId: data.breedId,
        speciesId: data.speciesId,
        populationKind: data.populationKind as BreedHierarchyNode["populationKind"],
        parentBreedId: data.parentBreedId,
      }, parentBreed).map((error) => `breedHierarchy:${error}`));
    }
  }
  return [...new Set(missing)];
}

export function classifyWorldbuildingResearch(envelope: WorldbuildingResearchEnvelope, context: { existingRefs: ReadonlySet<string>; personalityIds: ReadonlySet<string>; speciesKindsByRef?: Readonly<Record<string, SpeciesKind>>; breedHierarchyByRef?: Readonly<Record<string, BreedHierarchyNode>> }) {
  const rows = envelope.records.map((record) => ({ ...record, issues: [] as string[] }));
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const id = ownedId(row);
    const group = grouped.get(id) ?? [];
    group.push(row);
    grouped.set(id, group);
  }
  const canonicalRows: typeof rows = [];
  for (const [id, group] of grouped) {
    const names = new Set(group.map((row) => String(row.data.name)));
    if (names.size > 1) {
      for (const row of group) {
        row.researchStatus = "ID_COLLISION_REVIEW_REQUIRED";
        row.importStatus = "RESEARCH_COMPLETE_BLOCKED";
        row.issues.push(`canonical-id-collision:${id}:${[...names].join("|")}`);
      }
    } else if (new Set(group.map((row) => canonical(row.data))).size > 1) {
      for (const row of group) {
        row.researchStatus = "CONFLICTING_SOURCES";
        row.importStatus = "RESEARCH_COMPLETE_BLOCKED";
        row.issues.push(`canonical-data-conflict:${id}`);
      }
    }
    const evidence = [...new Map(group.flatMap((row) => row.evidence ?? []).map((entry) => [canonical(entry), entry])).values()];
    canonicalRows.push({ ...group[0]!, evidence: evidence.length ? evidence : undefined });
  }
  const available = new Set(context.existingRefs);
  const importableClosure: string[] = [];
  const classifyRow = (row: typeof canonicalRows[number]): void => {
      if (row.researchStatus !== "RESOLVED" || row.importStatus !== "RESEARCH_COMPLETE_IMPORTABLE") {
        row.importStatus = "RESEARCH_COMPLETE_BLOCKED";
        return;
      }
      const stagedSpecies = row.speciesRef ? rows.find((candidate) => candidate.kind === "SPECIES" && candidate.speciesRef === row.speciesRef) : undefined;
      const parentSpeciesKind = stagedSpecies?.data.speciesKind as SpeciesKind | undefined ?? (row.speciesRef ? context.speciesKindsByRef?.[row.speciesRef] : undefined);
      const parentBreedId = row.kind === "BREED" && nonblank(row.data.parentBreedId) ? row.data.parentBreedId : null;
      const stagedParent = parentBreedId ? canonicalRows.find((candidate) => candidate.kind === "BREED" && ownedId(candidate) === parentBreedId) : undefined;
      const parentBreed = stagedParent ? {
        breedId: ownedId(stagedParent),
        speciesId: String(stagedParent.data.speciesId ?? stagedParent.speciesRef ?? ""),
        populationKind: stagedParent.data.populationKind as BreedHierarchyNode["populationKind"],
        parentBreedId: nonblank(stagedParent.data.parentBreedId) ? stagedParent.data.parentBreedId : null,
      } : parentBreedId ? context.breedHierarchyByRef?.[parentBreedId] ?? null : null;
      const missing = missingRequired(row, context.personalityIds, parentSpeciesKind, parentBreed);
      if (row.kind === "BREED" && row.speciesRef && !available.has(row.speciesRef)) missing.push(`dependency:${row.speciesRef}`);
      if (row.kind === "BREED" && row.cultureRef && !available.has(row.cultureRef)) missing.push(`dependency:${row.cultureRef}`);
      if (parentBreedId && !available.has(parentBreedId)) missing.push(`dependency:${parentBreedId}`);
      if (missing.length) {
        row.importStatus = "RESEARCH_COMPLETE_BLOCKED";
        row.issues.push(...missing);
      } else {
        const id = ownedId(row);
        if (!importableClosure.includes(id)) importableClosure.push(id);
        available.add(id);
      }
  };
  for (const kind of ["SPECIES", "CULTURE"] as const) for (const row of canonicalRows.filter((candidate) => candidate.kind === kind)) classifyRow(row);
  const pendingBreeds = canonicalRows.filter((candidate) => candidate.kind === "BREED");
  const stagedBreedIds = new Set(pendingBreeds.map(ownedId));
  const pendingIds = new Set(stagedBreedIds);
  while (pendingIds.size) {
    const ready = pendingBreeds.filter((row) => {
      if (!pendingIds.has(ownedId(row))) return false;
      const parentBreedId = nonblank(row.data.parentBreedId) ? row.data.parentBreedId : null;
      return !parentBreedId || !stagedBreedIds.has(parentBreedId) || available.has(parentBreedId);
    });
    if (!ready.length) {
      for (const row of pendingBreeds.filter((candidate) => pendingIds.has(ownedId(candidate)))) {
        row.importStatus = "RESEARCH_COMPLETE_BLOCKED";
        row.issues.push(`dependency:${String(row.data.parentBreedId)}`, "BREED_HIERARCHY_CYCLE_OR_BLOCKED_PARENT");
        pendingIds.delete(ownedId(row));
      }
      break;
    }
    for (const row of ready) { classifyRow(row); pendingIds.delete(ownedId(row)); }
  }
  for (const canonicalRow of canonicalRows) {
    for (const row of grouped.get(ownedId(canonicalRow)) ?? []) {
      row.researchStatus = canonicalRow.researchStatus;
      row.importStatus = canonicalRow.importStatus;
      row.issues = [...canonicalRow.issues];
    }
  }
  return { rows, canonicalRows, importableClosure };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function bindWorldbuildingResearchReview(
  envelope: WorldbuildingResearchEnvelope,
  classified: ReturnType<typeof classifyWorldbuildingResearch>,
  reviewedIdMap: Readonly<Record<string, string>> = {},
) {
  const idMap: Record<string, string> = {};
  const stagedIds = new Set(envelope.records.map(ownedId));
  const externalDependencyRefs = new Set(
    envelope.records.flatMap((record) => [record.speciesRef, record.cultureRef, nonblank(record.data.parentBreedId) ? record.data.parentBreedId : undefined])
      .filter((reference): reference is string => Boolean(reference) && !stagedIds.has(reference!)),
  );
  for (const reference of externalDependencyRefs) {
    if (reviewedIdMap[reference] && reviewedIdMap[reference] !== reference) throw new Error(`Canonical dependency ID ${reference} cannot be replaced by ${reviewedIdMap[reference]}.`);
    if (reviewedIdMap[reference]) idMap[reference] = reference;
  }
  for (const canonicalId of classified.importableClosure) {
    if (reviewedIdMap[canonicalId] && reviewedIdMap[canonicalId] !== canonicalId) throw new Error(`Canonical persistence ID ${canonicalId} cannot be replaced by ${reviewedIdMap[canonicalId]}.`);
    idMap[canonicalId] = canonicalId;
  }
  const digest = createHash("sha256").update(canonical({ envelope, idMap })).digest("hex");
  return { digest, idMap };
}

interface WorldbuildingResearchDelegate {
  findUnique(input: { where: Record<string, string> }): Promise<Record<string, unknown> | null>;
  create(input: { data: Record<string, unknown> }): Promise<unknown>;
}
interface WorldbuildingResearchTransaction {
  taxonomy: WorldbuildingResearchDelegate;
  species: WorldbuildingResearchDelegate;
  culture: WorldbuildingResearchDelegate;
  breed: WorldbuildingResearchDelegate;
}

function taxonomyPersistenceRows(value: unknown): Record<string, unknown>[] {
  if (value === null || value === undefined) return [];
  const errors = validateTaxonomy(value);
  if (errors.length) throw new Error(errors.join(" "));
  const lineage: Record<string, unknown>[] = [];
  let current = value as Record<string, unknown> | null;
  while (current) {
    const parent = current.parent && typeof current.parent === "object" && !Array.isArray(current.parent) ? current.parent as Record<string, unknown> : null;
    lineage.push({
      taxonomyLevelId: current.taxonomyLevelId,
      type: current.type,
      name: current.name,
      isOfficial: current.isOfficial,
      text: current.text ?? null,
      commonName: current.commonName ?? null,
      parentTaxonomyLevelId: parent?.taxonomyLevelId ?? null,
    });
    current = parent;
  }
  return lineage.reverse();
}
export interface WorldbuildingResearchDatabase {
  $transaction<Result>(work: (transaction: WorldbuildingResearchTransaction) => Promise<Result>): Promise<Result>;
}

function persistenceData(row: ReturnType<typeof classifyWorldbuildingResearch>["rows"][number], idMap: Readonly<Record<string, string>>): Record<string, unknown> {
  const canonicalId = ownedId(row);
  const id = idMap[canonicalId];
  if (!id) throw new Error(`Reviewed idMap has no persistence ID for ${canonicalId}.`);
  if (id !== canonicalId) throw new Error(`Reviewed idMap cannot replace canonical persistence ID ${canonicalId}.`);
  const data = row.data;
  if (row.kind === "SPECIES") return {
    speciesId: id,
    name: data.name,
    speciesKind: data.speciesKind,
    scientificName: data.scientificName ?? null,
    taxonomyLevelId: data.taxonomy && typeof data.taxonomy === "object" && !Array.isArray(data.taxonomy)
      ? (data.taxonomy as Record<string, unknown>).taxonomyLevelId
      : null,
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
    name: data.name,
    appearance: data.appearance ?? null,
    clothing: data.clothing ?? null,
    architecture: data.architecture ?? null,
  };
  const speciesId = row.speciesRef ? idMap[row.speciesRef] : undefined;
  const cultureId = row.cultureRef ? idMap[row.cultureRef] : null;
  const parentBreedId = nonblank(data.parentBreedId) ? idMap[data.parentBreedId] : null;
  if (!speciesId) throw new Error(`Reviewed idMap cannot resolve Species dependency ${row.speciesRef ?? "missing"}.`);
  if (row.cultureRef && !cultureId) throw new Error(`Reviewed idMap cannot resolve Culture dependency ${row.cultureRef}.`);
  if (nonblank(data.parentBreedId) && !parentBreedId) throw new Error(`Reviewed idMap cannot resolve Breed parent dependency ${data.parentBreedId}.`);
  return {
    breedId: id,
    name: data.name,
    speciesId,
    cultureId,
    parentBreedId,
    groupId: data.groupId,
    populationKind: data.populationKind,
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
  const rebound = bindWorldbuildingResearchReview(envelope, classified, review.idMap);
  if (rebound.digest !== review.digest || canonical(rebound.idMap) !== canonical(review.idMap)) throw new Error("Reviewed WorldBuilding payload or idMap drifted after review.");
  return database.$transaction(async (transaction) => {
    let applied = 0;
    let unchanged = 0;
    for (const kind of ["SPECIES", "CULTURE", "BREED"] as const) {
      for (const canonicalId of classified.importableClosure) {
        const row = classified.canonicalRows.find((candidate) => ownedId(candidate) === canonicalId && candidate.kind === kind);
        if (!row) continue;
        if (kind === "SPECIES") {
          for (const taxonomyData of taxonomyPersistenceRows(row.data.taxonomy)) {
            const taxonomyLevelId = String(taxonomyData.taxonomyLevelId);
            const existingTaxonomy = await transaction.taxonomy.findUnique({ where: { taxonomyLevelId } });
            if (!existingTaxonomy) await transaction.taxonomy.create({ data: taxonomyData });
            else if (canonical(Object.fromEntries(Object.keys(taxonomyData).map((key) => [key, existingTaxonomy[key]]))) !== canonical(taxonomyData)) {
              throw new Error(`TAXONOMY ${taxonomyLevelId} conflicts with persisted canonical data.`);
            }
          }
        }
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
          throw new Error(`${kind} ${canonicalId} conflicts with persisted canonical data.`);
        }
      }
    }
    return { applied, unchanged, retainedBlocked: classified.canonicalRows.length - classified.importableClosure.length };
  });
}
