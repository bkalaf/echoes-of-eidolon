import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { applyGenericEntityImportInTransaction } from "./entity-admin";

export type CanonicalPackageRow = Record<string, unknown>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

function canonicalAuthoredValue(value: unknown): string {
  return canonical(value === undefined ? null : value);
}

export function findCanonicalRowDrift(
  expectedRows: readonly CanonicalPackageRow[],
  persistedRows: readonly CanonicalPackageRow[],
  idField: "speciesId" | "cultureId" | "breedId",
): string[] {
  const persistedById = new Map(persistedRows.map((row) => [String(row[idField]), row]));
  return expectedRows.flatMap((expected) => {
    const id = String(expected[idField]);
    const persisted = persistedById.get(id);
    if (!persisted) return [`${id}:missing`];
    return Object.keys(expected).flatMap((field) => canonicalAuthoredValue(persisted[field]) === canonicalAuthoredValue(expected[field]) ? [] : [`${id}:${field}`]);
  });
}

export function mergeCanonicalRows(
  baseRows: readonly CanonicalPackageRow[],
  additionalRows: readonly CanonicalPackageRow[],
  patches: readonly CanonicalPackageRow[],
  idField: "speciesId" | "cultureId" | "breedId",
): CanonicalPackageRow[] {
  const rows = new Map<string, CanonicalPackageRow>();
  for (const row of [...baseRows, ...additionalRows]) {
    const id = row[idField];
    if (typeof id !== "string" || !id) throw new Error(`Canonical package row is missing ${idField}.`);
    const existing = rows.get(id);
    if (existing && canonical(existing) !== canonical(row)) throw new Error(`Canonical package contains conflicting ${idField} ${id}.`);
    rows.set(id, { ...row });
  }
  for (const patch of patches) {
    const id = patch[idField];
    if (typeof id !== "string" || !id) throw new Error(`Canonical package patch is missing ${idField}.`);
    const existing = rows.get(id);
    if (!existing) throw new Error(`Canonical package patch references missing ${idField} ${id}.`);
    const authoredPatch = { ...patch };
    delete authoredPatch.reason;
    rows.set(id, { ...existing, ...authoredPatch });
  }
  return [...rows.values()];
}

export function orderBreedRowsParentFirst(rows: readonly CanonicalPackageRow[]): CanonicalPackageRow[] {
  const byId = new Map<string, CanonicalPackageRow>();
  for (const row of rows) {
    const breedId = row.breedId;
    if (typeof breedId !== "string" || !breedId) throw new Error("Canonical Breed row is missing breedId.");
    if (byId.has(breedId)) throw new Error(`Canonical package duplicates breedId ${breedId}.`);
    byId.set(breedId, row);
  }
  for (const row of rows) {
    if (typeof row.parentBreedId === "string" && row.parentBreedId && !byId.has(row.parentBreedId)) {
      throw new Error(`Breed ${String(row.breedId)} references missing parent ${row.parentBreedId}.`);
    }
  }
  const pending = new Set(byId.keys());
  const ordered: CanonicalPackageRow[] = [];
  while (pending.size) {
    const ready = [...pending].filter((breedId) => {
      const parent = byId.get(breedId)?.parentBreedId;
      return typeof parent !== "string" || !parent || !pending.has(parent);
    });
    if (!ready.length) throw new Error(`Breed hierarchy cycle prevents canonical import: ${[...pending].join(",")}.`);
    for (const breedId of ready) {
      ordered.push(byId.get(breedId)!);
      pending.delete(breedId);
    }
  }
  return ordered;
}

export interface CanonicalWorldbuildingPayload {
  species: CanonicalPackageRow[];
  cultures: CanonicalPackageRow[];
  breeds: CanonicalPackageRow[];
}

export interface CanonicalWorldbuildingImportResult {
  species: { changed: number; unchanged: number };
  cultures: { changed: number; unchanged: number };
  breeds: { changed: number; unchanged: number };
}

async function applyChunks(
  transaction: Prisma.TransactionClient,
  entity: "Species" | "Culture" | "Breed",
  rows: readonly CanonicalPackageRow[],
): Promise<{ changed: number; unchanged: number }> {
  const result = { changed: 0, unchanged: 0 };
  for (let index = 0; index < rows.length; index += 1_000) {
    const chunk = rows.slice(index, index + 1_000);
    const applied = await applyGenericEntityImportInTransaction(chunk, entity, transaction as unknown as PrismaClient);
    result.changed += applied.changed;
    result.unchanged += applied.unchanged;
  }
  return result;
}

export async function importCanonicalWorldbuildingPayload(database: PrismaClient, payload: CanonicalWorldbuildingPayload): Promise<CanonicalWorldbuildingImportResult> {
  return database.$transaction(async (transaction) => ({
    species: await applyChunks(transaction, "Species", payload.species),
    cultures: await applyChunks(transaction, "Culture", payload.cultures),
    breeds: await applyChunks(transaction, "Breed", orderBreedRowsParentFirst(payload.breeds)),
  }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 300_000 });
}

export async function auditCanonicalWorldbuildingPayload(database: PrismaClient, payload: CanonicalWorldbuildingPayload) {
  const [species, cultures, breeds] = await Promise.all([
    database.species.findMany({ where: { speciesId: { in: payload.species.map((row) => String(row.speciesId)) } } }),
    database.culture.findMany({ where: { cultureId: { in: payload.cultures.map((row) => String(row.cultureId)) } } }),
    database.breed.findMany({ where: { breedId: { in: payload.breeds.map((row) => String(row.breedId)) } } }),
  ]);
  const expected = { species: payload.species.length, cultures: payload.cultures.length, breeds: payload.breeds.length };
  const counts = { species: species.length, cultures: cultures.length, breeds: breeds.length };
  const drift = [
    ...findCanonicalRowDrift(payload.species, species as unknown as CanonicalPackageRow[], "speciesId"),
    ...findCanonicalRowDrift(payload.cultures, cultures as unknown as CanonicalPackageRow[], "cultureId"),
    ...findCanonicalRowDrift(payload.breeds, breeds as unknown as CanonicalPackageRow[], "breedId"),
  ];
  return {
    counts,
    expected,
    issues: [
      ...(Object.keys(expected) as Array<keyof typeof expected>).flatMap((key) => counts[key] === expected[key] ? [] : [`Expected ${expected[key]} canonical ${key}; found ${counts[key]}.`]),
      ...drift.map((entry) => `Canonical field drift: ${entry}.`),
    ],
  };
}
