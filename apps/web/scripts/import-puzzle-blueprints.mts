import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PUZZLE_BLUEPRINT_PACKAGE_SHA256 } from "../src/domain/puzzle-blueprint-package";
import { importPuzzleBlueprintPackage } from "../src/server/puzzle-blueprint-import";

const knownArguments = new Set(["--verify-only"]);
const unknownArgument = process.argv.slice(2).find((argument) => !knownArguments.has(argument));
if (unknownArgument) throw new Error(`Unknown Puzzle Blueprint import argument: ${unknownArgument}`);

const sourcePath = fileURLToPath(new URL("../data/puzzles/puzzle-blueprint-bank-70.csv", import.meta.url));
const source = readFileSync(sourcePath, "utf8");
const checksum = createHash("sha256").update(source).digest("hex");
if (checksum !== PUZZLE_BLUEPRINT_PACKAGE_SHA256) {
  throw new Error(`Puzzle Blueprint package checksum mismatch: expected ${PUZZLE_BLUEPRINT_PACKAGE_SHA256}, received ${checksum}.`);
}

const result = await importPuzzleBlueprintPackage(source, { verifyOnly: process.argv.includes("--verify-only") });
console.log(JSON.stringify({ checksum, ...result }, null, 2));

