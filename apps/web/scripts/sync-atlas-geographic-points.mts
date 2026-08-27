import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const applicationRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(applicationRoot, "../..");
const simulatorRoot = resolve(process.env.EIDOLON_SIMULATOR_ROOT ?? resolve(repositoryRoot, "../echoes-simulator"));
const sourceRelativePath = "resources/canonical/atlas/pois_by_site_naming.csv";
const sourcePath = resolve(simulatorRoot, sourceRelativePath);
const outputPath = resolve(applicationRoot, "src/data/atlas-geographic-points.json");

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field.length > 0 || row.length > 0) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  if (quoted) throw new Error("Simulator Atlas POI CSV contains an unterminated quoted field.");
  return rows;
}

const sourceBytes = await readFile(sourcePath);
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
const rows = parseCsv(sourceBytes.toString("utf8").replace(/^\uFEFF/, ""));
const headers = rows.shift();
if (!headers) throw new Error("Simulator Atlas POI CSV is empty.");
const objects = rows.filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
if (objects.length !== 92) throw new Error(`Simulator Atlas POI count is ${objects.length}, expected 92.`);

const records = objects.map((record) => {
  const name = (record.poiCurrentName || record.poiWorkingLabel).trim();
  const latitude = Number(record.poiLatitude);
  const longitude = Number(record.poiLongitude);
  if (!/^POI-\d{3}$/.test(record.poiId) || !/^R\d{2}$/.test(record.regionId) || !record.poiType || !name
    || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`Simulator Atlas geographic point is invalid: ${record.poiId || "unknown"}.`);
  }
  return { category: record.poiType, latitude, longitude, name, poiId: record.poiId, regionId: record.regionId };
}).sort((left, right) => left.poiId.localeCompare(right.poiId));
if (new Set(records.map(({ poiId }) => poiId)).size !== 92) throw new Error("Simulator Atlas POI IDs are not unique.");

await execute("git", ["-C", simulatorRoot, "diff", "--quiet", "--", sourceRelativePath]);
const { stdout } = await execute("git", ["-C", simulatorRoot, "rev-parse", "HEAD"]);
const output = {
  records,
  source: {
    repository: "bkalaf/echoes-simulator",
    revision: stdout.trim(),
    sourcePath: sourceRelativePath,
    sourceSha256,
  },
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(`atlas-geographic-points ${records.length} ${sourceSha256} ${outputPath}\n`);
