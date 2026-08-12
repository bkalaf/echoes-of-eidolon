import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { parseSoundtrackSourcePath } from "../src/domain/soundtrack";
import { PrismaClient } from "../src/generated/prisma/client";

const execute = promisify(execFile);
const appRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(appRoot, "../..");
const sourceRoot = resolve(process.env.SOUNDTRACK_SOURCE_ROOT ?? "/home/bobby/Dropbox/soundtracks");
const verifyOnly = process.argv.includes("--verify-only");

async function discoverSoundtracks() {
  const discovered: Array<{ category: "CITY" | "TAVERN"; cultureKey: string; displayName: string; logicalKey: string; source: string; sourceFilename: string }> = [];
  const invalid: string[] = [];
  for (const directory of await readdir(sourceRoot, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const directoryPath = join(sourceRoot, directory.name);
    for (const file of await readdir(directoryPath, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.toLowerCase().endsWith(".mp3")) continue;
      const source = join(directoryPath, file.name);
      const identity = parseSoundtrackSourcePath(source);
      if (!identity) { invalid.push(source); continue; }
      discovered.push({ ...identity, logicalKey: `soundtrack.${identity.cultureKey.toLowerCase()}.${identity.category.toLowerCase()}`, source });
    }
  }
  if (invalid.length > 0) throw new Error(`Invalid soundtrack source names:\n${invalid.join("\n")}`);
  discovered.sort((left, right) => left.logicalKey.localeCompare(right.logicalKey));
  const unique = new Set(discovered.map((entry) => entry.logicalKey));
  if (unique.size !== discovered.length) throw new Error("Duplicate soundtrack culture/category source detected.");
  return discovered;
}

async function reconcileSoundtrackRecords(entries: Awaited<ReturnType<typeof discoverSoundtracks>>) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to reconcile Soundtrack records.");
  const manifest = JSON.parse(await readFile(resolve(appRoot, "src/data/managed-assets.json"), "utf8")) as Record<string, { sha256: string }>;
  const pool = new Pool({ connectionString: databaseUrl });
  const database = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    for (const entry of entries) {
      const managedAssetId = manifest[entry.logicalKey]?.sha256;
      if (!managedAssetId) throw new Error(`Managed soundtrack purpose is missing after asset reconciliation: ${entry.logicalKey}`);
      const soundtrackId = `SOUNDTRACK_${entry.cultureKey}_${entry.category}`;
      const current = await database.soundtrack.findUnique({ where: { soundtrackId } });
      const expected = { cultureSourceKey: entry.cultureKey, displayName: entry.displayName, managedAssetId, sourceFilename: basename(entry.source) };
      if (verifyOnly) {
        if (!current || current.cultureSourceKey !== expected.cultureSourceKey || current.displayName !== expected.displayName || current.managedAssetId !== expected.managedAssetId || current.sourceFilename !== expected.sourceFilename) {
          throw new Error(`Soundtrack database record drift: ${soundtrackId}`);
        }
      } else {
        await database.soundtrack.upsert({ where: { soundtrackId }, create: { soundtrackId, ...expected }, update: expected });
      }
    }
  } finally {
    await database.$disconnect();
    await pool.end();
  }
}

async function main() {
  const entries = await discoverSoundtracks();
  if (entries.length === 0) throw new Error(`No soundtrack MP3 sources were found under ${sourceRoot}.`);
  const temporaryRoot = await mkdtemp(join(tmpdir(), "eidolon-soundtracks-"));
  const configPath = join(temporaryRoot, "import-sources.json");
  try {
    await writeFile(configPath, `${JSON.stringify({ entries: entries.map(({ logicalKey, source }) => ({ logicalKey, source })) }, null, 2)}\n`);
    const arguments_ = [resolve(appRoot, "scripts/import-managed-assets.mjs"), configPath];
    if (verifyOnly) arguments_.push("--verify-only");
    const result = await execute(process.execPath, arguments_, { cwd: repositoryRoot, env: process.env, maxBuffer: 10 * 1024 * 1024 });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    await reconcileSoundtrackRecords(entries);
    process.stdout.write(`soundtracks ${entries.length} ${verifyOnly ? "verified" : "reconciled"}\n`);
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

await main();
