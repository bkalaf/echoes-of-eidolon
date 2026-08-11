import { z } from "zod";
import { CanonicalImportDriftError } from "./import-errors";

const schema = z.object({
  name: z.string().refine((value) => value.trim().length > 0, "name cannot be blank"),
  personalityExpressionId: z.string().refine((value) => value.trim().length > 0, "personalityExpressionId cannot be blank"),
}).strict();
export type PersonalityExpressionImportRow = z.infer<typeof schema>;

interface Tx { personalityExpression: {
  createMany(input: { data: PersonalityExpressionImportRow[] }): Promise<{ count: number }>;
  findMany(input: { select: { name: true; personalityExpressionId: true }; where: { personalityExpressionId: { in: string[] } } }): Promise<PersonalityExpressionImportRow[]>;
} }
export interface PersonalityExpressionImportDatabase { transaction<Result>(work: (transaction: Tx) => Promise<Result>): Promise<Result> }

export function parsePersonalityExpressionImportRows(value: unknown): PersonalityExpressionImportRow[] {
  const rows = z.array(schema).min(1).parse(value);
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.personalityExpressionId)) throw new Error(`Import duplicates personalityExpressionId ${row.personalityExpressionId}.`);
    ids.add(row.personalityExpressionId);
  }
  return rows;
}

export async function applyPersonalityExpressionImport(value: unknown, database: PersonalityExpressionImportDatabase) {
  const rows = parsePersonalityExpressionImportRows(value);
  return database.transaction(async (transaction) => {
    const existing = await transaction.personalityExpression.findMany({ select: { name: true, personalityExpressionId: true }, where: { personalityExpressionId: { in: rows.map((row) => row.personalityExpressionId) } } });
    const byId = new Map(existing.map((row) => [row.personalityExpressionId, row]));
    for (const row of rows) {
      const current = byId.get(row.personalityExpressionId);
      if (current && current.name !== row.name) {
        throw new CanonicalImportDriftError(`Canonical drift refused for PersonalityExpression ${row.personalityExpressionId}.`);
      }
    }
    const missing = rows.filter((row) => !byId.has(row.personalityExpressionId));
    if (missing.length) await transaction.personalityExpression.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}
