import { z } from "zod";

const soulImportRowSchema = z.object({
  name: z.string().refine((value) => value.trim().length > 0, "name cannot be blank"),
  soulId: z.string().refine((value) => value.trim().length > 0, "soulId cannot be blank"),
}).strict();

const definitionImportRowSchema = z.object({
  definition: z.string().refine((value) => value.trim().length > 0, "definition cannot be blank"),
  definitionId: z.string().refine((value) => value.trim().length > 0, "definitionId cannot be blank"),
  term: z.string().refine((value) => value.trim().length > 0, "term cannot be blank"),
}).strict();

export type SoulImportRow = z.infer<typeof soulImportRowSchema>;
export type DefinitionImportRow = z.infer<typeof definitionImportRowSchema>;

interface SoulImportTransaction {
  soul: {
    createMany(input: { data: SoulImportRow[] }): Promise<{ count: number }>;
    findMany(input: {
      select: { name: true; soulId: true };
      where: { soulId: { in: string[] } };
    }): Promise<SoulImportRow[]>;
  };
}

export interface SoulImportDatabase {
  transaction<Result>(work: (transaction: SoulImportTransaction) => Promise<Result>): Promise<Result>;
}

interface DefinitionImportTransaction {
  definition: {
    createMany(input: { data: DefinitionImportRow[] }): Promise<{ count: number }>;
    findMany(input: {
      select: { definition: true; definitionId: true; term: true };
      where: { definitionId: { in: string[] } };
    }): Promise<DefinitionImportRow[]>;
  };
}

export interface DefinitionImportDatabase {
  transaction<Result>(work: (transaction: DefinitionImportTransaction) => Promise<Result>): Promise<Result>;
}

export class UnsupportedImportEntityError extends Error {}
export class CanonicalImportDriftError extends Error {}

export function parseSoulImportRows(value: unknown): SoulImportRow[] {
  const rows = z.array(soulImportRowSchema).min(1, "Import requires at least one row.").parse(value);
  const identifiers = new Set<string>();
  for (const row of rows) {
    if (identifiers.has(row.soulId)) throw new Error(`Import duplicates soulId ${row.soulId}.`);
    identifiers.add(row.soulId);
  }
  return rows;
}

export function parseDefinitionImportRows(value: unknown): DefinitionImportRow[] {
  const rows = z.array(definitionImportRowSchema).min(1, "Import requires at least one row.").parse(value);
  const identifiers = new Set<string>();
  for (const row of rows) {
    if (identifiers.has(row.definitionId)) throw new Error(`Import duplicates definitionId ${row.definitionId}.`);
    identifiers.add(row.definitionId);
  }
  return rows;
}

export async function applySoulImport(
  value: unknown,
  database: SoulImportDatabase,
): Promise<{ changed: number; unchanged: number }> {
  const rows = parseSoulImportRows(value);

  return database.transaction(async (transaction) => {
    const existing = await transaction.soul.findMany({
      select: { name: true, soulId: true },
      where: { soulId: { in: rows.map((row) => row.soulId) } },
    });
    const existingById = new Map(existing.map((row) => [row.soulId, row]));

    for (const row of rows) {
      const persisted = existingById.get(row.soulId);
      if (persisted && persisted.name !== row.name) {
        throw new CanonicalImportDriftError(`Canonical drift refused for Soul ${row.soulId}.`);
      }
    }

    const missing = rows.filter((row) => !existingById.has(row.soulId));
    if (missing.length > 0) await transaction.soul.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}

export async function applyDefinitionImport(
  value: unknown,
  database: DefinitionImportDatabase,
): Promise<{ changed: number; unchanged: number }> {
  const rows = parseDefinitionImportRows(value);
  return database.transaction(async (transaction) => {
    const existing = await transaction.definition.findMany({
      select: { definition: true, definitionId: true, term: true },
      where: { definitionId: { in: rows.map((row) => row.definitionId) } },
    });
    const existingById = new Map(existing.map((row) => [row.definitionId, row]));
    for (const row of rows) {
      const persisted = existingById.get(row.definitionId);
      if (persisted && (persisted.term !== row.term || persisted.definition !== row.definition)) {
        throw new CanonicalImportDriftError(`Canonical drift refused for Definition ${row.definitionId}.`);
      }
    }
    const missing = rows.filter((row) => !existingById.has(row.definitionId));
    if (missing.length > 0) await transaction.definition.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}

export async function applyRegisteredEntityImport(
  entityKey: string,
  value: unknown,
  database: SoulImportDatabase | DefinitionImportDatabase,
) {
  if (entityKey === "soul") return applySoulImport(value, database as SoulImportDatabase);
  if (entityKey === "definition") return applyDefinitionImport(value, database as DefinitionImportDatabase);
  throw new UnsupportedImportEntityError(`Typed import is unavailable for entity key ${entityKey}.`);
}
