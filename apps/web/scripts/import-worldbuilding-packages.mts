import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import process from "node:process";

import { disconnectDatabase, getDatabase } from "../src/server/database";
import {
  auditCanonicalWorldbuildingPayload,
  importCanonicalWorldbuildingPayload,
  mergeCanonicalRows,
  type CanonicalPackageRow,
} from "../src/server/worldbuilding-package-import";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`${name} requires an explicit ZIP path.`);
  return value;
}

function zipEntry(zipPath: string, entry: string): Buffer {
  return execFileSync("unzip", ["-p", zipPath, entry], { maxBuffer: 32 * 1024 * 1024 });
}

function jsonLines(zipPath: string, entry: string): CanonicalPackageRow[] {
  return zipEntry(zipPath, entry).toString("utf8").split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line) as CanonicalPackageRow);
}

function validateChecksum(zipPath: string, ledgerEntry: string, entry: string): void {
  const ledger = zipEntry(zipPath, ledgerEntry).toString("utf8");
  const localName = entry.split("/").at(-1)!;
  const expected = ledger.split(/\r?\n/).map((line) => line.trim().split(/\s+/, 2)).find(([, name]) => name === localName)?.[0];
  if (!expected) throw new Error(`Checksum ledger ${ledgerEntry} does not cover ${entry}.`);
  const actual = createHash("sha256").update(zipEntry(zipPath, entry)).digest("hex");
  if (actual !== expected) throw new Error(`Checksum mismatch for ${entry}.`);
}

const baseZip = argument("--base");
const deltaZip = argument("--delta");
const apply = process.argv.includes("--apply");
const audit = process.argv.includes("--audit");
if (apply === audit) throw new Error("Use exactly one of --apply or --audit.");
const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
if (!new Set(["localhost", "127.0.0.1", "[::1]"]).has(databaseUrl.hostname)) throw new Error("WorldBuilding package import is restricted to a local database.");

const baseFiles = {
  species: ["human/import_ready_species.jsonl", "beast_pet/import_ready_species.jsonl", "mythos/import_ready_species.jsonl"],
  cultures: ["human/import_ready_cultures.jsonl"],
  breeds: ["human/import_ready_breeds.jsonl", "beast_pet/import_ready_breeds.jsonl", "mythos/import_ready_breeds.jsonl"],
};
for (const entries of Object.values(baseFiles)) for (const entry of entries) validateChecksum(baseZip, `${entry.split("/")[0]}/checksums.sha256`, entry);
const deltaFiles = ["new_beast_species.jsonl", "new_mythos_species.jsonl", "new_human_breeds.jsonl", "new_beast_breeds.jsonl", "new_mythos_breeds.jsonl", "parent_breed_updates.jsonl", "species_presentation_updates.jsonl"];
for (const entry of deltaFiles) validateChecksum(deltaZip, "checksums.sha256", entry);

const payload = {
  species: mergeCanonicalRows(
    baseFiles.species.flatMap((entry) => jsonLines(baseZip, entry)),
    ["new_beast_species.jsonl", "new_mythos_species.jsonl"].flatMap((entry) => jsonLines(deltaZip, entry)),
    jsonLines(deltaZip, "species_presentation_updates.jsonl"),
    "speciesId",
  ),
  cultures: mergeCanonicalRows(baseFiles.cultures.flatMap((entry) => jsonLines(baseZip, entry)), [], [], "cultureId"),
  breeds: mergeCanonicalRows(
    baseFiles.breeds.flatMap((entry) => jsonLines(baseZip, entry)),
    ["new_human_breeds.jsonl", "new_beast_breeds.jsonl", "new_mythos_breeds.jsonl"].flatMap((entry) => jsonLines(deltaZip, entry)),
    jsonLines(deltaZip, "parent_breed_updates.jsonl"),
    "breedId",
  ),
};

const database = getDatabase();
try {
  const result = apply
    ? { import: await importCanonicalWorldbuildingPayload(database, payload), audit: await auditCanonicalWorldbuildingPayload(database, payload) }
    : { audit: await auditCanonicalWorldbuildingPayload(database, payload) };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await disconnectDatabase();
}
