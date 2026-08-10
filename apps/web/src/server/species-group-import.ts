import { z } from "zod";
import { SpeciesKind } from "../generated/prisma/enums";
import { CanonicalImportDriftError } from "./import-errors";

const schema = z.object({
  description: z.string().refine((value) => value.trim().length > 0, "description cannot be blank").nullable(),
  name: z.string().refine((value) => value.trim().length > 0, "name cannot be blank"),
  speciesGroupId: z.string().refine((value) => value.trim().length > 0, "speciesGroupId cannot be blank"),
  speciesKind: z.enum(SpeciesKind),
}).strict();
export type SpeciesGroupImportRow = z.infer<typeof schema>;
interface Tx { speciesGroup: {
  createMany(input: { data: SpeciesGroupImportRow[] }): Promise<{ count: number }>;
  findMany(input: { select: { description: true; name: true; speciesGroupId: true; speciesKind: true }; where: { speciesGroupId: { in: string[] } } }): Promise<SpeciesGroupImportRow[]>;
} }
export interface SpeciesGroupImportDatabase { transaction<Result>(work: (transaction: Tx) => Promise<Result>): Promise<Result> }

export function parseSpeciesGroupImportRows(value: unknown): SpeciesGroupImportRow[] {
  const rows = z.array(schema).min(1).parse(value); const ids = new Set<string>();
  for (const row of rows) { if (ids.has(row.speciesGroupId)) throw new Error(`Import duplicates speciesGroupId ${row.speciesGroupId}.`); ids.add(row.speciesGroupId); }
  return rows;
}
export async function applySpeciesGroupImport(value: unknown, database: SpeciesGroupImportDatabase) {
  const rows = parseSpeciesGroupImportRows(value);
  return database.transaction(async (transaction) => {
    const existing = await transaction.speciesGroup.findMany({ select: { description: true, name: true, speciesGroupId: true, speciesKind: true }, where: { speciesGroupId: { in: rows.map((row) => row.speciesGroupId) } } });
    const byId = new Map(existing.map((row) => [row.speciesGroupId, row]));
    for (const row of rows) { const current = byId.get(row.speciesGroupId); if (current && (current.name !== row.name || current.description !== row.description || current.speciesKind !== row.speciesKind)) throw new CanonicalImportDriftError(`Canonical drift refused for SpeciesGroup ${row.speciesGroupId}.`); }
    const missing = rows.filter((row) => !byId.has(row.speciesGroupId)); if (missing.length) await transaction.speciesGroup.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}
