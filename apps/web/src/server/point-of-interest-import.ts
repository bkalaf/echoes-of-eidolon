import { z } from "zod";
import { RegionId } from "../generated/prisma/enums";
import { CanonicalImportDriftError } from "./import-errors";

const schema = z.object({
  kind: z.string().min(1), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  name: z.string().min(1), pointOfInterestId: z.string().min(1), regionId: z.enum(RegionId),
}).strict();
export type PointOfInterestImportRow = z.infer<typeof schema>;
interface Tx { pointOfInterest: {
  createMany(input: { data: PointOfInterestImportRow[] }): Promise<{ count: number }>;
  findMany(input: { select: { kind: true; latitude: true; longitude: true; name: true; pointOfInterestId: true; regionId: true }; where: { pointOfInterestId: { in: string[] } } }): Promise<PointOfInterestImportRow[]>;
} }
export interface PointOfInterestImportDatabase { transaction<Result>(work: (transaction: Tx) => Promise<Result>): Promise<Result> }
export function parsePointOfInterestImportRows(value: unknown): PointOfInterestImportRow[] {
  const rows = z.array(schema).min(1).parse(value); const ids = new Set<string>();
  for (const row of rows) { if (ids.has(row.pointOfInterestId)) throw new Error(`Import duplicates pointOfInterestId ${row.pointOfInterestId}.`); ids.add(row.pointOfInterestId); }
  return rows;
}
export async function applyPointOfInterestImport(value: unknown, database: PointOfInterestImportDatabase) {
  const rows = parsePointOfInterestImportRows(value);
  return database.transaction(async (transaction) => {
    const existing = await transaction.pointOfInterest.findMany({ select: { kind: true, latitude: true, longitude: true, name: true, pointOfInterestId: true, regionId: true }, where: { pointOfInterestId: { in: rows.map((row) => row.pointOfInterestId) } } });
    const byId = new Map(existing.map((row) => [row.pointOfInterestId, row]));
    for (const row of rows) { const current = byId.get(row.pointOfInterestId); if (current && (current.name !== row.name || current.kind !== row.kind || current.regionId !== row.regionId || current.latitude !== row.latitude || current.longitude !== row.longitude)) throw new CanonicalImportDriftError(`Canonical drift refused for PointOfInterest ${row.pointOfInterestId}.`); }
    const missing = rows.filter((row) => !byId.has(row.pointOfInterestId)); if (missing.length) await transaction.pointOfInterest.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}
