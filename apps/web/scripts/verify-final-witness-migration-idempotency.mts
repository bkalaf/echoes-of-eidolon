import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

import { Client } from "pg";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
if (!new Set(["localhost", "127.0.0.1", "[::1]"]).has(databaseUrl.hostname)) {
  throw new Error("Final Witness migration idempotency verification is restricted to a local database.");
}

const client = new Client({ connectionString: databaseUrl.toString() });
const migrationPath = resolve(import.meta.dirname, "../prisma/migrations/20260829010000_final_witness_data_remediation/migration.sql");
const outputPath = resolve(import.meta.dirname, "../../../artifacts/release-0.3.0/witness-remediation/migration-idempotency.json");
const writeArtifact = !process.argv.includes("--no-write");

async function snapshot() {
  const definitions = await client.query(`SELECT "witnessDefId", "kernelKey", "worldKey", "bookNumber" FROM "WitnessDef" ORDER BY "witnessDefId"`);
  const demographics = await client.query(`SELECT witness."characterId", character."age", character."gender"
    FROM "Witness" witness JOIN "Character" character USING ("characterId") ORDER BY witness."characterId"`);
  const relations = await client.query(`SELECT "characterId", "witnessDefId", "architectCharacterId", "legendaryRewardId", "constellationBeforeId", "constellationAfterId"
    FROM "Witness" ORDER BY "characterId"`);
  return { definitions: definitions.rows, demographics: demographics.rows, relations: relations.rows };
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

await client.connect();
try {
  const before = await snapshot();
  await client.query(await readFile(migrationPath, "utf8"));
  const after = await snapshot();
  const result = {
    schemaVersion: "final-witness-migration-idempotency-v1",
    databaseHost: databaseUrl.hostname,
    databaseName: databaseUrl.pathname.slice(1),
    migration: "20260829010000_final_witness_data_remediation",
    rowsExamined: { Witness: after.relations.length, WitnessDef: after.definitions.length, WitnessCharacter: after.demographics.length },
    beforeDigest: digest(before),
    afterDigest: digest(after),
    secondRunChangedRows: JSON.stringify(before) === JSON.stringify(after) ? 0 : null,
    status: JSON.stringify(before) === JSON.stringify(after) ? "PASS" : "FAIL",
  };
  if (writeArtifact) {
    await mkdir(resolve(outputPath, ".."), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "PASS" || after.definitions.length !== 54 || after.demographics.length !== 54 || after.relations.length !== 54) process.exitCode = 1;
} finally {
  await client.end();
}
