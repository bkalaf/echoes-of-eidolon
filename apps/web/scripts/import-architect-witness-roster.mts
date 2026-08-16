import process from "node:process";

import { auditArchitectWitnessPopulation, importCanonicalArchitectWitnessPopulation } from "../src/server/architect-witness-import";
import { disconnectDatabase, getDatabase } from "../src/server/database";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
if (!new Set(["localhost", "127.0.0.1", "[::1]"]).has(databaseUrl.hostname)) {
  throw new Error("Architect/Witness roster commands are restricted to a local database.");
}
const apply = process.argv.includes("--apply");
const audit = process.argv.includes("--audit");
if (apply === audit) throw new Error("Use exactly one of --apply or --audit.");

const database = getDatabase();
try {
  const result = apply
    ? { import: await importCanonicalArchitectWitnessPopulation(database), audit: await auditArchitectWitnessPopulation(database) }
    : { audit: await auditArchitectWitnessPopulation(database) };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await disconnectDatabase();
}
