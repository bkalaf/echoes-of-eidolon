import { describe, expect, it, vi } from "vitest";
import {
  applyPersonalityExpressionImport,
  parsePersonalityExpressionImportRows,
} from "../../src/server/personality-expression-import";

const row = {
  collaborativePosture: "HELPFUL" as const,
  emotionalTemperature: "COMPOSED" as const,
  loquacity: "TALKATIVE" as const,
  name: "Supplied expression",
  outlookOrientation: "OPTIMISTIC" as const,
  personalityExpressionId: "PERSONALITY-1",
};

describe("typed PersonalityExpression import", () => {
  it("requires every exact Prisma dimension and rejects unknown fields", () => {
    expect(parsePersonalityExpressionImportRows([row])).toEqual([row]);
    expect(() => parsePersonalityExpressionImportRows([{ ...row, loquacity: "VERBOSE" }])).toThrow();
    expect(() => parsePersonalityExpressionImportRows([{ ...row, collaborativePosture: "UNAVAILABLE" }])).toThrow();
    const missing = { ...row } as Partial<typeof row>;
    delete missing.outlookOrientation;
    expect(() => parsePersonalityExpressionImportRows([missing])).toThrow();
    expect(() => parsePersonalityExpressionImportRows([{ ...row, color: "blue" }])).toThrow();
  });

  it("rejects duplicate identifiers", () => {
    expect(() => parsePersonalityExpressionImportRows([row, row]))
      .toThrow("duplicates personalityExpressionId PERSONALITY-1");
  });

  it("creates atomically, reruns idempotently, and refuses dimension drift", async () => {
    const stored = new Map<string, typeof row>();
    const database = { transaction: vi.fn(async <Result>(work: (client: { personalityExpression: {
      createMany(input: { data: typeof row[] }): Promise<{ count: number }>;
      findMany(input: { select: { collaborativePosture: true; emotionalTemperature: true; loquacity: true; name: true; outlookOrientation: true; personalityExpressionId: true }; where: { personalityExpressionId: { in: string[] } } }): Promise<typeof row[]>;
    } }) => Promise<Result>) => work({ personalityExpression: {
      async createMany({ data }) { for (const item of data) stored.set(item.personalityExpressionId, { ...item }); return { count: data.length }; },
      async findMany({ where }) { return where.personalityExpressionId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []); },
    } })) };
    await expect(applyPersonalityExpressionImport([row], database)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyPersonalityExpressionImport([row], database)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyPersonalityExpressionImport([{ ...row, loquacity: "LIGHT_BANTER" }], database))
      .rejects.toThrow("Canonical drift refused for PersonalityExpression PERSONALITY-1");
  });
});
