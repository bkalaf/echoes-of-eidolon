import { describe, expect, it, vi } from "vitest";
import {
  applyPersonalityExpressionImport,
  canonicalPersonalityExpressions,
  parsePersonalityExpressionImportRows,
} from "../../src/server/personality-expression-import";

const row = {
  personalityId: "ACCOUNTABILITY_CURSE_EXCUSE_CONFLICT",
  family: "ACCOUNTABILITY" as const,
  expression: "CURSE_EXCUSE",
  dominantFaction: ["CONCORD" as const],
};

describe("typed PersonalityExpression import", () => {
  it("keeps authoritative Breed selections out of descriptive expressions", () => {
    expect(parsePersonalityExpressionImportRows([row])).toEqual([row]);
    expect(canonicalPersonalityExpressions).toHaveLength(369);
    expect(() => parsePersonalityExpressionImportRows([{ ...row, loquacity: "TALKATIVE" }])).toThrow();
    expect(() => parsePersonalityExpressionImportRows([{ ...row, color: "blue" }])).toThrow();
  });

  it("rejects duplicate identifiers", () => {
    expect(() => parsePersonalityExpressionImportRows([row, row]))
      .toThrow("duplicates personalityId ACCOUNTABILITY_CURSE_EXCUSE_CONFLICT");
  });

  it("creates atomically, reruns idempotently, and refuses dimension drift", async () => {
    const stored = new Map<string, typeof row>();
    const database = { transaction: vi.fn(async <Result>(work: (client: { personalityExpression: {
      createMany(input: { data: typeof row[] }): Promise<{ count: number }>;
      findMany(input: { select: { personalityId: true; family: true; expression: true; dominantFaction: true }; where: { personalityId: { in: string[] } } }): Promise<typeof row[]>;
    } }) => Promise<Result>) => work({ personalityExpression: {
      async createMany({ data }) { for (const item of data) stored.set(item.personalityId, { ...item }); return { count: data.length }; },
      async findMany({ where }) { return where.personalityId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []); },
    } })) };
    await expect(applyPersonalityExpressionImport([row], database)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyPersonalityExpressionImport([row], database)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyPersonalityExpressionImport([{ ...row, expression: "CHANGED" }], database))
      .rejects.toThrow("Canonical drift refused for PersonalityExpression ACCOUNTABILITY_CURSE_EXCUSE_CONFLICT");
  });
});
