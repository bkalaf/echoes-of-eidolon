import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

import { disconnectDatabase, getDatabase } from "../src/server/database";
import {
  WORLD_BUILDING_RESEARCH_SCHEMA_VERSION,
  applyWorldbuildingResearchReview,
  bindWorldbuildingResearchReview,
  classifyWorldbuildingResearch,
  parseWorldbuildingResearchEnvelope,
  type WorldbuildingImportIdAllocator,
  type WorldbuildingResearchDatabase,
} from "../src/server/worldbuilding-research";
import type { SpeciesKind } from "../src/domain/worldbuilding";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const inputPath = flag("--input");
const reviewPath = flag("--review");
const reviewOutPath = flag("--review-out");
const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run");
if (!inputPath || apply === dryRun || (apply && !reviewPath)) {
  throw new Error("Usage: worldbuilding-research --input <pack.json> (--dry-run [--review previous.json] [--review-out reviewed.json] | --apply --review reviewed.json)");
}

const envelope = parseWorldbuildingResearchEnvelope(JSON.parse(await readFile(inputPath, "utf8")));
const reviewed = reviewPath ? JSON.parse(await readFile(reviewPath, "utf8")) as { digest: string; idMap: Record<string, string>; schemaVersion: string } : undefined;
if (reviewed && reviewed.schemaVersion !== WORLD_BUILDING_RESEARCH_SCHEMA_VERSION) throw new Error("Reviewed WorldBuilding schemaVersion does not match the authorized contract.");
const database = getDatabase();
const personalityIds = new Set((await database.personalityExpression.findMany({ select: { personalityId: true } })).map((row) => row.personalityId));
const existingRefs = new Set<string>();
const speciesKindsByRef: Record<string, SpeciesKind> = {};
const referencedKinds = new Map<string, "SPECIES" | "CULTURE" | "BREED">();
for (const row of envelope.records) {
  referencedKinds.set(row.recordKey, row.kind);
  if (row.speciesRef && row.speciesRef !== row.recordKey) referencedKinds.set(row.speciesRef, "SPECIES");
  if (row.cultureRef && row.cultureRef !== row.recordKey) referencedKinds.set(row.cultureRef, "CULTURE");
}
for (const [reference, kind] of referencedKinds) {
  const id = reviewed?.idMap[reference];
  if (!id) continue;
  if (kind === "SPECIES") {
    const existing = await database.species.findUnique({ select: { speciesKind: true }, where: { speciesId: id } });
    if (existing) { existingRefs.add(reference); speciesKindsByRef[reference] = existing.speciesKind; }
  } else if (kind === "CULTURE") {
    if (await database.culture.findUnique({ select: { cultureId: true }, where: { cultureId: id } })) existingRefs.add(reference);
  } else if (await database.breed.findUnique({ select: { breedId: true }, where: { breedId: id } })) existingRefs.add(reference);
}
const classified = classifyWorldbuildingResearch(envelope, { existingRefs, personalityIds, speciesKindsByRef });
const allocator: WorldbuildingImportIdAllocator = { allocate() { return randomUUID(); } };
const binding = bindWorldbuildingResearchReview(envelope, classified, allocator, reviewed?.idMap);

if (dryRun) {
  const result = { schemaVersion: WORLD_BUILDING_RESEARCH_SCHEMA_VERSION, digest: binding.digest, idMap: binding.idMap, rows: classified.rows, importableClosure: classified.importableClosure };
  if (reviewOutPath) await writeFile(reviewOutPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ digest: result.digest, statuses: Object.fromEntries(result.rows.map((row) => [row.recordKey, row.status])), importableClosure: result.importableClosure, reviewOut: reviewOutPath ?? null }, null, 2)}\n`);
} else {
  if (!reviewed || reviewed.digest !== binding.digest || JSON.stringify(reviewed.idMap) !== JSON.stringify(binding.idMap)) throw new Error("Apply refused because the reviewed payload/idMap digest drifted.");
  const result = await applyWorldbuildingResearchReview(envelope, classified, binding, database as unknown as WorldbuildingResearchDatabase);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

await disconnectDatabase();
