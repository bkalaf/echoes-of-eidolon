import { describe, expect, it, vi } from "vitest";
import { applySpeciesGroupImport, parseSpeciesGroupImportRows } from "../../src/server/species-group-import";

const row = { description: null, name: "Supplied group", speciesGroupId: "GROUP-1", speciesKind: "BEAST" as const };

describe("typed SpeciesGroup import", () => {
  it("requires exact SpeciesKind and explicit nullable description", () => {
    expect(parseSpeciesGroupImportRows([row])).toEqual([row]);
    expect(() => parseSpeciesGroupImportRows([{ ...row, speciesKind: "CREATURE" }])).toThrow();
    const missing = { ...row } as Partial<typeof row>; delete missing.description;
    expect(() => parseSpeciesGroupImportRows([missing])).toThrow();
    expect(() => parseSpeciesGroupImportRows([{ ...row, speciesIds: [] }])).toThrow();
  });

  it("applies idempotently and refuses drift", async () => {
    const stored = new Map<string, typeof row>();
    const database = { transaction: vi.fn(async <Result>(work: (client: { speciesGroup: {
      createMany(input: { data: typeof row[] }): Promise<{ count: number }>;
      findMany(input: { select: { description: true; name: true; speciesGroupId: true; speciesKind: true }; where: { speciesGroupId: { in: string[] } } }): Promise<typeof row[]>;
    } }) => Promise<Result>) => work({ speciesGroup: {
      async createMany({ data }) { for (const item of data) stored.set(item.speciesGroupId, { ...item }); return { count: data.length }; },
      async findMany({ where }) { return where.speciesGroupId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []); },
    } })) };
    await expect(applySpeciesGroupImport([row], database)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applySpeciesGroupImport([row], database)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applySpeciesGroupImport([{ ...row, speciesKind: "PET" }], database))
      .rejects.toThrow("Canonical drift refused for SpeciesGroup GROUP-1");
  });
});
