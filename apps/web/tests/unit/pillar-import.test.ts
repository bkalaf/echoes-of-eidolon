import { describe, expect, it, vi } from "vitest";

import { applyPillarImport, parsePillarImportRows } from "../../src/server/pillar-import";

interface Row { domain?: string; name: string; pillarId: string; seatNumber?: number }

function database(initial: Row[] = []) {
  const stored = new Map(initial.map((row) => [row.pillarId, { ...row }]));
  const transaction = vi.fn(async <Result>(work: (client: {
    pillar: {
      createMany(input: { data: Row[] }): Promise<{ count: number }>;
      findMany(input: {
        select: { domain: true; name: true; pillarId: true; seatNumber: true };
        where: { pillarId: { in: string[] } };
      }): Promise<Row[]>;
    };
  }) => Promise<Result>) => work({ pillar: {
    async createMany({ data }) { for (const row of data) stored.set(row.pillarId, { ...row }); return { count: data.length }; },
    async findMany({ where }) { return where.pillarId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []); },
  } }));
  return { stored, transaction };
}

describe("typed Pillar import", () => {
  const row: Row = { name: "Supplied pillar", pillarId: "PILLAR-1" };

  it("accepts omitted optional fields without inventing a seat range", () => {
    expect(parsePillarImportRows([row])).toEqual([row]);
    expect(parsePillarImportRows([{ ...row, domain: "Supplied domain", seatNumber: 0 }]))
      .toEqual([{ ...row, domain: "Supplied domain", seatNumber: 0 }]);
    expect(() => parsePillarImportRows([{ ...row, seatNumber: 1.5 }])).toThrow();
    expect(() => parsePillarImportRows([{ ...row, book: 1 }])).toThrow();
  });

  it("rejects duplicates, applies idempotently, and refuses drift", async () => {
    expect(() => parsePillarImportRows([row, row])).toThrow("duplicates pillarId PILLAR-1");
    const db = database();
    await expect(applyPillarImport([row], db)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyPillarImport([row], db)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyPillarImport([{ ...row, seatNumber: 1 }], db))
      .rejects.toThrow("Canonical drift refused for Pillar PILLAR-1");
  });
});
