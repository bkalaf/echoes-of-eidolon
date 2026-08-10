import { z } from "zod";

import { CanonicalImportDriftError } from "./import-errors";

const nullableAuthoredString = z.string()
  .refine((value) => value.trim().length > 0, "authored coordinate cannot be blank")
  .nullable();

const constellationImportRowSchema = z.object({
  constellationId: z.string().refine((value) => value.trim().length > 0, "constellationId cannot be blank"),
  declination: nullableAuthoredString,
  name: z.string().refine((value) => value.trim().length > 0, "name cannot be blank"),
  rightAscension: nullableAuthoredString,
}).strict();

export type ConstellationImportRow = z.infer<typeof constellationImportRowSchema>;

interface ConstellationImportTransaction {
  constellation: {
    createMany(input: { data: ConstellationImportRow[] }): Promise<{ count: number }>;
    findMany(input: {
      select: { constellationId: true; declination: true; name: true; rightAscension: true };
      where: { constellationId: { in: string[] } };
    }): Promise<ConstellationImportRow[]>;
  };
}

export interface ConstellationImportDatabase {
  transaction<Result>(work: (transaction: ConstellationImportTransaction) => Promise<Result>): Promise<Result>;
}

export function parseConstellationImportRows(value: unknown): ConstellationImportRow[] {
  const rows = z.array(constellationImportRowSchema).min(1, "Import requires at least one row.").parse(value);
  const identifiers = new Set<string>();
  for (const row of rows) {
    if (identifiers.has(row.constellationId)) {
      throw new Error(`Import duplicates constellationId ${row.constellationId}.`);
    }
    identifiers.add(row.constellationId);
  }
  return rows;
}

export async function applyConstellationImport(
  value: unknown,
  database: ConstellationImportDatabase,
): Promise<{ changed: number; unchanged: number }> {
  const rows = parseConstellationImportRows(value);
  return database.transaction(async (transaction) => {
    const existing = await transaction.constellation.findMany({
      select: { constellationId: true, declination: true, name: true, rightAscension: true },
      where: { constellationId: { in: rows.map((row) => row.constellationId) } },
    });
    const existingById = new Map(existing.map((row) => [row.constellationId, row]));
    for (const row of rows) {
      const persisted = existingById.get(row.constellationId);
      if (persisted && (
        persisted.name !== row.name ||
        persisted.rightAscension !== row.rightAscension ||
        persisted.declination !== row.declination
      )) {
        throw new CanonicalImportDriftError(`Canonical drift refused for Constellation ${row.constellationId}.`);
      }
    }
    const missing = rows.filter((row) => !existingById.has(row.constellationId));
    if (missing.length > 0) await transaction.constellation.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}
