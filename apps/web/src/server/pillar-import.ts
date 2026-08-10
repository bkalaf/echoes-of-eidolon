import { z } from "zod";

import { CanonicalImportDriftError } from "./import-errors";

const pillarImportRowSchema = z.object({
  domain: z.string().refine((value) => value.trim().length > 0, "domain cannot be blank").optional(),
  name: z.string().refine((value) => value.trim().length > 0, "name cannot be blank"),
  pillarId: z.string().refine((value) => value.trim().length > 0, "pillarId cannot be blank"),
  seatNumber: z.number().int().optional(),
}).strict();

export type PillarImportRow = z.infer<typeof pillarImportRowSchema>;

interface PillarImportTransaction {
  pillar: {
    createMany(input: { data: PillarImportRow[] }): Promise<{ count: number }>;
    findMany(input: {
      select: { domain: true; name: true; pillarId: true; seatNumber: true };
      where: { pillarId: { in: string[] } };
    }): Promise<Array<Omit<PillarImportRow, "domain" | "seatNumber"> & { domain: string | null; seatNumber: number | null }>>;
  };
}

export interface PillarImportDatabase {
  transaction<Result>(work: (transaction: PillarImportTransaction) => Promise<Result>): Promise<Result>;
}

export function parsePillarImportRows(value: unknown): PillarImportRow[] {
  const rows = z.array(pillarImportRowSchema).min(1, "Import requires at least one row.").parse(value);
  const identifiers = new Set<string>();
  for (const row of rows) {
    if (identifiers.has(row.pillarId)) throw new Error(`Import duplicates pillarId ${row.pillarId}.`);
    identifiers.add(row.pillarId);
  }
  return rows;
}

export async function applyPillarImport(
  value: unknown,
  database: PillarImportDatabase,
): Promise<{ changed: number; unchanged: number }> {
  const rows = parsePillarImportRows(value);
  return database.transaction(async (transaction) => {
    const existing = await transaction.pillar.findMany({
      select: { domain: true, name: true, pillarId: true, seatNumber: true },
      where: { pillarId: { in: rows.map((row) => row.pillarId) } },
    });
    const existingById = new Map(existing.map((row) => [row.pillarId, row]));
    for (const row of rows) {
      const persisted = existingById.get(row.pillarId);
      if (persisted && (
        persisted.name !== row.name ||
        (persisted.domain ?? null) !== (row.domain ?? null) ||
        (persisted.seatNumber ?? null) !== (row.seatNumber ?? null)
      )) {
        throw new CanonicalImportDriftError(`Canonical drift refused for Pillar ${row.pillarId}.`);
      }
    }
    const missing = rows.filter((row) => !existingById.has(row.pillarId));
    if (missing.length > 0) await transaction.pillar.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}
