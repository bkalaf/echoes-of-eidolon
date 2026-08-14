import { z } from "zod";

import registry from "../data/personality-expression-registry-v3.json";
import { Faction, PersonalityFamily } from "../generated/prisma/enums";
import { CanonicalImportDriftError } from "./import-errors";

const schema = z.object({
  personalityId: z.string().trim().min(1),
  family: z.enum(PersonalityFamily),
  expression: z.string().trim().min(1),
  dominantFaction: z.array(z.enum(Faction)).min(1).refine((values) => new Set(values).size === values.length, "dominantFaction cannot contain duplicates"),
}).strict();
export type PersonalityExpressionImportRow = z.infer<typeof schema>;

export const canonicalPersonalityExpressions = Object.freeze(registry.map((row) => Object.freeze(schema.parse(row))));
const canonicalById = new Map(canonicalPersonalityExpressions.map((row) => [row.personalityId, row]));

interface Tx { personalityExpression: {
  createMany(input: { data: PersonalityExpressionImportRow[] }): Promise<{ count: number }>;
  findMany(input: { select: { personalityId: true; family: true; expression: true; dominantFaction: true }; where: { personalityId: { in: string[] } } }): Promise<PersonalityExpressionImportRow[]>;
} }
export interface PersonalityExpressionImportDatabase { transaction<Result>(work: (transaction: Tx) => Promise<Result>): Promise<Result> }

function equal(left: PersonalityExpressionImportRow, right: PersonalityExpressionImportRow): boolean {
  return left.personalityId === right.personalityId && left.family === right.family && left.expression === right.expression
    && JSON.stringify(left.dominantFaction) === JSON.stringify(right.dominantFaction);
}

export function parsePersonalityExpressionImportRows(value: unknown): PersonalityExpressionImportRow[] {
  const rows = z.array(schema).min(1).parse(value);
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.personalityId)) throw new Error(`Import duplicates personalityId ${row.personalityId}.`);
    ids.add(row.personalityId);
  }
  return rows;
}

export async function applyPersonalityExpressionImport(value: unknown, database: PersonalityExpressionImportDatabase) {
  const rows = parsePersonalityExpressionImportRows(value);
  for (const row of rows) {
    const canonical = canonicalById.get(row.personalityId);
    if (!canonical || !equal(row, canonical)) throw new CanonicalImportDriftError(`Canonical drift refused for PersonalityExpression ${row.personalityId}.`);
  }
  return database.transaction(async (transaction) => {
    const existing = await transaction.personalityExpression.findMany({ select: { personalityId: true, family: true, expression: true, dominantFaction: true }, where: { personalityId: { in: rows.map((row) => row.personalityId) } } });
    const byId = new Map(existing.map((row) => [row.personalityId, row]));
    for (const row of rows) {
      const current = byId.get(row.personalityId);
      if (current && !equal(row, current)) throw new CanonicalImportDriftError(`Canonical drift refused for PersonalityExpression ${row.personalityId}.`);
    }
    const missing = rows.filter((row) => !byId.has(row.personalityId));
    if (missing.length) await transaction.personalityExpression.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}
