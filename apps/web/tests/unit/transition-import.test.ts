import { describe, expect, it, vi } from "vitest";
import { applyTransitionImport, parseTransitionImportRows } from "../../src/server/transition-import";

const row = { bookA: 1, bookB: 18, name: "Supplied transition", summary: "Supplied summary", transitionId: "TRANSITION-1" };

describe("typed Transition import", () => {
  it("requires one exact approved Book pair and exact fields", () => {
    expect(parseTransitionImportRows([row])).toEqual([row]);
    expect(() => parseTransitionImportRows([{ ...row, bookB: 2 }])).toThrow();
    expect(() => parseTransitionImportRows([{ ...row, bookA: 0 }])).toThrow();
    expect(() => parseTransitionImportRows([{ ...row, worldKey: "CONCORD" }])).toThrow();
  });

  it("applies idempotently and refuses drift", async () => {
    const stored = new Map<string, typeof row>();
    const database = { transaction: vi.fn(async <Result>(work: (client: { transition: {
      createMany(input: { data: typeof row[] }): Promise<{ count: number }>;
      findMany(input: { select: { bookA: true; bookB: true; name: true; summary: true; transitionId: true }; where: { transitionId: { in: string[] } } }): Promise<typeof row[]>;
    } }) => Promise<Result>) => work({ transition: {
      async createMany({ data }) { for (const item of data) stored.set(item.transitionId, { ...item }); return { count: data.length }; },
      async findMany({ where }) { return where.transitionId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []); },
    } })) };
    await expect(applyTransitionImport([row], database)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyTransitionImport([row], database)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyTransitionImport([{ ...row, name: "Changed" }], database))
      .rejects.toThrow("Canonical drift refused for Transition TRANSITION-1");
  });
});
