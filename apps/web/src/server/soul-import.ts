import { z } from "zod";

const soulImportRowSchema = z.object({
  name: z.string().refine((value) => value.trim().length > 0, "name cannot be blank"),
  soulId: z.string().refine((value) => value.trim().length > 0, "soulId cannot be blank"),
}).strict();

export type SoulImportRow = z.infer<typeof soulImportRowSchema>;

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

export async function applyRegisteredEntityImport(
  entityKey: string,
  value: unknown,
  database: SoulImportDatabase,
) {
  if (entityKey !== "soul") {
    throw new UnsupportedImportEntityError(`Typed import is unavailable for entity key ${entityKey}.`);
  }
  return applySoulImport(value, database);
}
