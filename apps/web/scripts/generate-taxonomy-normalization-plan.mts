import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { normalizeTaxonomyPreflight, type SpeciesTaxonomyPreflightRow } from "../src/domain/taxonomy-normalization";

const args = new Map(process.argv.slice(2).map((value, index, values) => value.startsWith("--") ? [value, values[index + 1]] : ["", ""]));
const inputPath = resolve(args.get("--input") ?? "");
const preflightPath = resolve(args.get("--preflight-output") ?? "artifacts/taxonomy-json-preflight.json");
const planPath = resolve(args.get("--plan-output") ?? "artifacts/taxonomy-normalization-plan.json");
if (!args.get("--input")) throw new Error("--input is required.");

const inputBytes = await readFile(inputPath);
const rows = JSON.parse(inputBytes.toString("utf8")) as SpeciesTaxonomyPreflightRow[];
const plan = normalizeTaxonomyPreflight(rows);
const generatedAt = new Date().toISOString();
const sourceSha256 = createHash("sha256").update(inputBytes).digest("hex");

await writeFile(preflightPath, `${JSON.stringify({
  schemaVersion: "eidolon-taxonomy-json-preflight-v1",
  generatedAt,
  source: { kind: "production-read-only-export", sha256: sourceSha256 },
  species: rows,
}, null, 2)}\n`);
await writeFile(planPath, `${JSON.stringify({ generatedAt, sourceSha256, ...plan }, null, 2)}\n`);

console.log(`taxonomy-preflight species=${plan.speciesCount} withTaxonomy=${plan.speciesWithTaxonomy}`);
console.log(`taxonomy-plan nodes=${plan.uniqueTaxonomyNodeIds} sourceConflicts=${plan.sourceConflicts.length} unresolvedConflicts=${plan.conflicts.length}`);
if (plan.conflicts.length) process.exitCode = 1;
