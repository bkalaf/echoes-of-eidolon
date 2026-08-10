import { z } from "zod";
import { isValidCampaignSpan } from "../domain/campaign-planner";
import { CanonicalImportDriftError } from "./import-errors";

const schema = z.object({
  bookA: z.number().int().min(1).max(18),
  bookB: z.number().int().min(1).max(18),
  name: z.string().min(1),
  summary: z.string().min(1),
  transitionId: z.string().min(1),
}).strict().refine((row) => isValidCampaignSpan("TRANSITION", [row.bookA, row.bookB]), "Transition Books must be an approved pair.");

export type TransitionImportRow = z.infer<typeof schema>;
interface Tx { transition: {
  createMany(input: { data: TransitionImportRow[] }): Promise<{ count: number }>;
  findMany(input: { select: { bookA: true; bookB: true; name: true; summary: true; transitionId: true }; where: { transitionId: { in: string[] } } }): Promise<TransitionImportRow[]>;
} }
export interface TransitionImportDatabase { transaction<Result>(work: (transaction: Tx) => Promise<Result>): Promise<Result> }

export function parseTransitionImportRows(value: unknown): TransitionImportRow[] {
  const rows = z.array(schema).min(1).parse(value);
  const ids = new Set<string>();
  for (const row of rows) { if (ids.has(row.transitionId)) throw new Error(`Import duplicates transitionId ${row.transitionId}.`); ids.add(row.transitionId); }
  return rows;
}

export async function applyTransitionImport(value: unknown, database: TransitionImportDatabase) {
  const rows = parseTransitionImportRows(value);
  return database.transaction(async (transaction) => {
    const existing = await transaction.transition.findMany({ select: { bookA: true, bookB: true, name: true, summary: true, transitionId: true }, where: { transitionId: { in: rows.map((row) => row.transitionId) } } });
    const byId = new Map(existing.map((row) => [row.transitionId, row]));
    for (const row of rows) {
      const current = byId.get(row.transitionId);
      if (current && (current.bookA !== row.bookA || current.bookB !== row.bookB || current.name !== row.name || current.summary !== row.summary)) {
        throw new CanonicalImportDriftError(`Canonical drift refused for Transition ${row.transitionId}.`);
      }
    }
    const missing = rows.filter((row) => !byId.has(row.transitionId));
    if (missing.length) await transaction.transition.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}
