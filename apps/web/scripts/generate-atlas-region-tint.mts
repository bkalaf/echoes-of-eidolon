import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { createAtlasRegionOverlaySvg, validateAtlasRegionGeoJson } from "../src/domain/atlas-region-overlay";
import { loadAtlasReleaseBundle } from "../src/server/atlas";

const execute = promisify(execFile);
const appRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(appRoot, "../..");
const releaseRoot = resolve(process.env.EIDOLON_ATLAS_RELEASE_ROOT ?? resolve(repositoryRoot, "EIDOLON_ATLAS_DATASET_R09_AUTHORITATIVE_DEPLOYMENT_V2"));
const generatedRoot = resolve(repositoryRoot, ".local/assets/generated");
const svgPath = resolve(generatedRoot, "atlas-nimbus-region-tint.svg");
const pngPath = resolve(generatedRoot, "atlas-nimbus-region-tint.png");
const configPath = resolve(generatedRoot, "atlas-region-tint-import.json");
const width = 8192;
const height = 4096;

await loadAtlasReleaseBundle(releaseRoot);
const geography = validateAtlasRegionGeoJson(JSON.parse(await readFile(resolve(releaseRoot, "data/regions_25.geojson"), "utf8")) as unknown);
const svg = createAtlasRegionOverlaySvg(geography, width, height);
await mkdir(generatedRoot, { recursive: true });
await writeFile(svgPath, svg, "utf8");
await execute("magick", ["-background", "none", svgPath, "-alpha", "on", `PNG32:${pngPath}`], { maxBuffer: 1024 * 1024 * 10 });
const { stdout: signature } = await execute("magick", ["identify", "-format", "%m|%w|%h|%[channels]|%[bit-depth]", pngPath]);
if (signature.trim() !== "PNG|8192|4096|srgba 4.0|8") throw new Error(`Atlas Region tint signature mismatch: ${signature.trim()}`);
await writeFile(configPath, `${JSON.stringify({ entries: [{ logicalKey: "atlas.nimbus.region-tint", source: pngPath }] }, null, 2)}\n`, "utf8");
process.stdout.write(`atlas-region-tint ${pngPath} ${signature.trim()}\n`);
process.stdout.write(`atlas-region-tint-import ${configPath}\n`);
