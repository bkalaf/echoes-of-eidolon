import { describe, expect, it, vi } from "vitest";

import {
  applyConstellationImport,
  parseConstellationImportRows,
} from "../../src/server/constellation-import";

interface Row {
  constellationId: string;
  declination: string | null;
  name: string;
  rightAscension: string | null;
}

function database(initial: Row[] = []) {
  const stored = new Map(initial.map((row) => [row.constellationId, { ...row }]));
  const transaction = vi.fn(async <Result>(work: (client: {
    constellation: {
      createMany(input: { data: Row[] }): Promise<{ count: number }>;
      findMany(input: {
        select: { constellationId: true; declination: true; name: true; rightAscension: true };
        where: { constellationId: { in: string[] } };
      }): Promise<Row[]>;
    };
  }) => Promise<Result>) => work({ constellation: {
    async createMany({ data }) { for (const row of data) stored.set(row.constellationId, { ...row }); return { count: data.length }; },
    async findMany({ where }) { return where.constellationId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []); },
  } }));
  return { stored, transaction };
}

describe("typed Constellation import", () => {
  const row: Row = {
    constellationId: "CONSTELLATION-1",
    declination: null,
    name: "Supplied constellation",
    rightAscension: null,
  };

  it("requires exact fields and explicit nullable coordinate strings", () => {
    expect(parseConstellationImportRows([row])).toEqual([row]);
    expect(parseConstellationImportRows([{ ...row, declination: "Supplied declination" }]))
      .toEqual([{ ...row, declination: "Supplied declination" }]);
    expect(() => parseConstellationImportRows([{
      constellationId: row.constellationId,
      name: row.name,
      rightAscension: null,
    }])).toThrow();
    expect(() => parseConstellationImportRows([{ ...row, rightAscension: "" }])).toThrow();
    expect(() => parseConstellationImportRows([{ ...row, worldKey: "CONCORD" }])).toThrow();
  });

  it("rejects duplicate identifiers", () => {
    expect(() => parseConstellationImportRows([row, row]))
      .toThrow("duplicates constellationId CONSTELLATION-1");
  });

  it("creates atomically, reruns idempotently, and refuses drift", async () => {
    const db = database();
    await expect(applyConstellationImport([row], db)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyConstellationImport([row], db)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyConstellationImport([{ ...row, name: "Changed" }], db))
      .rejects.toThrow("Canonical drift refused for Constellation CONSTELLATION-1");
    expect([...db.stored.values()]).toEqual([row]);
  });
});
