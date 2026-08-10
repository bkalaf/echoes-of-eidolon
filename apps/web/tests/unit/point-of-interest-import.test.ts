import { describe, expect, it, vi } from "vitest";
import { applyPointOfInterestImport, parsePointOfInterestImportRows } from "../../src/server/point-of-interest-import";

const row = { kind: "Supplied kind", latitude: 12.5, longitude: -45.25, name: "Supplied point", pointOfInterestId: "POI-1", regionId: "R08" as const };

describe("typed PointOfInterest import", () => {
  it("enforces exact RegionId and coordinate ranges", () => {
    expect(parsePointOfInterestImportRows([row])).toEqual([row]);
    expect(() => parsePointOfInterestImportRows([{ ...row, regionId: "R26" }])).toThrow();
    expect(() => parsePointOfInterestImportRows([{ ...row, latitude: 90.01 }])).toThrow();
    expect(() => parsePointOfInterestImportRows([{ ...row, longitude: -180.01 }])).toThrow();
    expect(() => parsePointOfInterestImportRows([{ ...row, worldKey: "CONCORD" }])).toThrow();
  });

  it("applies idempotently and refuses coordinate drift", async () => {
    const stored = new Map<string, typeof row>();
    const database = { transaction: vi.fn(async <Result>(work: (client: { pointOfInterest: {
      createMany(input: { data: typeof row[] }): Promise<{ count: number }>;
      findMany(input: { select: { kind: true; latitude: true; longitude: true; name: true; pointOfInterestId: true; regionId: true }; where: { pointOfInterestId: { in: string[] } } }): Promise<typeof row[]>;
    } }) => Promise<Result>) => work({ pointOfInterest: {
      async createMany({ data }) { for (const item of data) stored.set(item.pointOfInterestId, { ...item }); return { count: data.length }; },
      async findMany({ where }) { return where.pointOfInterestId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []); },
    } })) };
    await expect(applyPointOfInterestImport([row], database)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyPointOfInterestImport([row], database)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyPointOfInterestImport([{ ...row, latitude: 13 }], database))
      .rejects.toThrow("Canonical drift refused for PointOfInterest POI-1");
  });
});
