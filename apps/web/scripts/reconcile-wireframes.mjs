import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const handoffRoot = resolve(repositoryRoot, "Echoes_UI_Closed_World_Implementation_Handoff_v11_3/Echoes_UI_Wireframe_Rebuild_v11_3_CLOSED_WORLD");
const sourceManifestPath = resolve(handoffRoot, "data/page_manifest_v11_2.json");
const applicationManifestPath = resolve(repositoryRoot, "apps/web/src/data/page-manifest.json");
const pngRoot = resolve(handoffRoot, "wireframes/png");
const outputPath = resolve(repositoryRoot, "docs/implementation/WIREFRAME_RECONCILIATION.md");
const source = JSON.parse(await readFile(sourceManifestPath, "utf8"));
const application = JSON.parse(await readFile(applicationManifestPath, "utf8"));
const canonical = (row) => JSON.stringify({
  page: row.page, screenId: row.screenId, title: row.title, path: row.path,
  source: row.source, originalPage: row.originalPage, reviewOrder: row.reviewOrder,
});
const sourceRows = new Map(source.map((row) => [row.reviewOrder, canonical(row)]));
const appRows = new Map(application.map((row) => [row.reviewOrder, canonical(row)]));
const missing = source.filter((row) => !appRows.has(row.reviewOrder));
const extra = application.filter((row) => !sourceRows.has(row.reviewOrder));
const mismatched = source.filter((row) => appRows.has(row.reviewOrder) && appRows.get(row.reviewOrder) !== canonical(row));
const pngFiles = (await readdir(pngRoot)).filter((name) => name.endsWith(".png")).sort();
const expectedPngs = new Set(source.map((row) => `${String(row.page).padStart(3, "0")}_${row.screenId}.png`));
const missingPngs = [...expectedPngs].filter((name) => !pngFiles.includes(name));
const supplementalPngs = pngFiles.filter((name) => !expectedPngs.has(name));
const duplicates = (field) => [...source.reduce((groups, row) => groups.set(row[field], [...(groups.get(row[field]) ?? []), row]), new Map())]
  .filter(([, rows]) => rows.length > 1);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
if (source.length !== 269 || application.length !== 269 || missing.length || extra.length || mismatched.length || missingPngs.length) {
  throw new Error(`Wireframe reconciliation failed: source=${source.length} app=${application.length} missing=${missing.length} extra=${extra.length} mismatched=${mismatched.length} missingPng=${missingPngs.length}`);
}
const lines = [
  "# v11.3 Wireframe and Registry Reconciliation",
  "",
  "## Result",
  "",
  "- Status: PASS",
  `- Active v11.3 source rows: ${source.length}`,
  `- Application registry rows: ${application.length}`,
  `- Exact canonical row matches: ${source.length - mismatched.length}`,
  `- Missing application rows: ${missing.length}`,
  `- Extra application rows: ${extra.length}`,
  `- Mismatched application rows: ${mismatched.length}`,
  `- Governed desktop source PNGs matched: ${expectedPngs.size}`,
  `- Missing governed source PNGs: ${missingPngs.length}`,
  `- Supplemental correction/reference PNGs outside the active manifest: ${supplementalPngs.length}`,
  "- Explicit mobile/responsive source variants: 0. Responsive layout remains a derived implementation requirement for every active row.",
  `- Source manifest SHA-256: \`${sha256(await readFile(sourceManifestPath))}\``,
  `- Application manifest SHA-256: \`${sha256(await readFile(applicationManifestPath))}\``,
  "",
  "Duplicate screen IDs and paths below are governed state variants. Review order is the unique row identity.",
  "",
  `- Repeated screen IDs: ${duplicates("screenId").length}`,
  `- Repeated route/modal-owner values: ${duplicates("path").length}`,
  "",
  "## Active registry",
  "",
  "| Review | Page | Screen/state ID | Title | Route or modal owner | Source |",
  "|---:|---:|---|---|---|---|",
  ...source.map((row) => `| ${row.reviewOrder} | ${row.page} | ${row.screenId} | ${row.title.replaceAll("|", "\\|")} | ${(row.path ?? "state-only").replaceAll("|", "\\|")} | ${row.source} |`),
  "",
  "## Supplemental source PNGs",
  "",
  ...(supplementalPngs.length ? supplementalPngs.map((name) => `- \`${name}\``) : ["- None"]),
  "",
];
await mkdir(resolve(repositoryRoot, "docs/implementation"), { recursive: true });
await writeFile(outputPath, lines.join("\n"), "utf8");
console.log(`wireframes ${source.length} exact rows ${expectedPngs.size} governed PNGs ${supplementalPngs.length} supplemental PNGs`);
/* global console */
