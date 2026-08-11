import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

const extractor = resolve(import.meta.dirname, "../../scripts/safe-extract-zip.py");

function makeZip(path: string, member: string) {
  execFileSync("python3", ["-c", [
    "import sys, zipfile",
    "with zipfile.ZipFile(sys.argv[1], 'w') as archive:",
    "    archive.writestr(sys.argv[2], b'bytes')",
  ].join("\n"), path, member]);
}

describe("safe managed-asset ZIP extraction", () => {
  it("extracts an exact bounded inventory and records checksums", () => {
    const root = mkdtempSync(join(tmpdir(), "eidolon-safe-zip-"));
    const archive = join(root, "valid.zip");
    const destination = join(root, "out");
    makeZip(archive, "package/asset.png");
    execFileSync("python3", [extractor, archive, destination, "package/asset.png"]);
    const inventory = JSON.parse(readFileSync(join(destination, ".safe-extraction-inventory.json"), "utf8"));
    expect(inventory.entryCount).toBe(1);
    expect(inventory.entries[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects traversal before writing a member", () => {
    const root = mkdtempSync(join(tmpdir(), "eidolon-unsafe-zip-"));
    const archive = join(root, "invalid.zip");
    makeZip(archive, "../escape.png");
    const result = spawnSync("python3", [extractor, archive, join(root, "out"), "../escape.png"], { encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("unsafe ZIP");
  });
});
