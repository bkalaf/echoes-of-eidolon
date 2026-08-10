import { describe, expect, it, vi } from "vitest";

import {
  applyRegisteredEntityImport,
  applySoulImport,
  parseSoulImportRows,
} from "../../src/server/soul-import";

interface StoredSoul {
  name: string;
  soulId: string;
}

function database(initial: StoredSoul[] = []) {
  const stored = new Map(initial.map((row) => [row.soulId, { ...row }]));
  const transaction = vi.fn(async <Result>(work: (client: {
    soul: {
      createMany(input: { data: StoredSoul[] }): Promise<{ count: number }>;
      findMany(input: {
        select: { name: true; soulId: true };
        where: { soulId: { in: string[] } };
      }): Promise<StoredSoul[]>;
    };
  }) => Promise<Result>) => {
    const snapshot = new Map([...stored].map(([key, value]) => [key, { ...value }]));
    try {
      return await work({
        soul: {
          async createMany({ data }) {
            for (const row of data) {
              if (stored.has(row.soulId)) throw new Error("duplicate");
              stored.set(row.soulId, { ...row });
            }
            return { count: data.length };
          },
          async findMany({ where }) {
            return where.soulId.in.flatMap((soulId) => {
              const row = stored.get(soulId);
              return row ? [{ ...row }] : [];
            });
          },
        },
      });
    } catch (error) {
      stored.clear();
      for (const [key, value] of snapshot) stored.set(key, value);
      throw error;
    }
  });

  return { stored, transaction };
}

describe("typed Soul import", () => {
  it("fails closed on every unregistered entity key", async () => {
    const db = database();
    await expect(applyRegisteredEntityImport("user-supplied-table", [], db))
      .rejects.toThrow("Typed import is unavailable for entity key user-supplied-table");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects empty batches, unknown fields, blank values, and duplicate identifiers", () => {
    expect(() => parseSoulImportRows([])).toThrow("at least one row");
    expect(() => parseSoulImportRows([{ soulId: "SOUL-1", name: "One", status: "READY" }])).toThrow();
    expect(() => parseSoulImportRows([{ soulId: "", name: "One" }])).toThrow();
    expect(() => parseSoulImportRows([{ soulId: "SOUL-1", name: "" }])).toThrow();
    expect(() => parseSoulImportRows([
      { soulId: "SOUL-1", name: "One" },
      { soulId: "SOUL-1", name: "One" },
    ])).toThrow("duplicates soulId SOUL-1");
  });

  it("creates missing rows together and reports exact results", async () => {
    const db = database();
    const result = await applySoulImport([
      { soulId: "SOUL-1", name: "One" },
      { soulId: "SOUL-2", name: "Two" },
    ], db);

    expect(result).toEqual({ changed: 2, unchanged: 0 });
    expect([...db.stored.values()]).toEqual([
      { soulId: "SOUL-1", name: "One" },
      { soulId: "SOUL-2", name: "Two" },
    ]);
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it("is idempotent when persisted rows match exactly", async () => {
    const db = database([{ soulId: "SOUL-1", name: "One" }]);

    await expect(applySoulImport([{ soulId: "SOUL-1", name: "One" }], db))
      .resolves.toEqual({ changed: 0, unchanged: 1 });
    expect([...db.stored.values()]).toEqual([{ soulId: "SOUL-1", name: "One" }]);
  });

  it("refuses canonical drift without partially creating missing rows", async () => {
    const db = database([{ soulId: "SOUL-2", name: "Canonical" }]);

    await expect(applySoulImport([
      { soulId: "SOUL-1", name: "New" },
      { soulId: "SOUL-2", name: "Changed" },
    ], db)).rejects.toThrow("Canonical drift refused for Soul SOUL-2");
    expect([...db.stored.values()]).toEqual([{ soulId: "SOUL-2", name: "Canonical" }]);
  });
});
