import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { assertPuzzleClientBundleSafe, validateReleaseState, runReleaseCheck } from "../../src/server/release-gate";

describe("release-note release gate", () => {
  it("RN-009 rejects root and web version drift", () => {
    expect(() => validateReleaseState({ rootVersion: "0.2.0", webVersion: "0.0.0", releases: [] })).toThrow(/version/i);
  });

  it("RN-010 requires the canonical current note", () => {
    expect(() => validateReleaseState({ rootVersion: "0.2.0", webVersion: "0.2.0", releases: [] })).toThrow(/canonical/i);
  });

  it("RN-011 verifies the prepared current repository state", async () => {
    await expect(runReleaseCheck(resolve(process.cwd(), "../.."))).resolves.toMatchObject({ currentVersion: "0.3.0", releaseDate: null, status: "DRAFT" });
  });

  it("rejects puzzle internals and source maps from non-admin production client bundles", () => {
    const root = mkdtempSync(resolve(tmpdir(), "eidolon-puzzle-bundle-"));
    const assets = resolve(root, "assets");
    mkdirSync(assets);
    writeFileSync(resolve(assets, "index-safe.js"), "const title='The Quiet Accord';");
    writeFileSync(resolve(assets, "PacketScreen-owner.js"), "const id='PZB-011'; const path='expectedSolvePath';");
    expect(() => assertPuzzleClientBundleSafe(assets)).not.toThrow();

    writeFileSync(resolve(assets, "puzzles-member.js"), "const id='PZB-011';");
    expect(() => assertPuzzleClientBundleSafe(assets)).toThrow(/puzzle internals/i);
    writeFileSync(resolve(assets, "puzzles-member.js"), "const title='The Quiet Accord';");
    writeFileSync(resolve(assets, "puzzles-member.js.map"), "{}");
    expect(() => assertPuzzleClientBundleSafe(assets)).toThrow(/source map/i);
  });
});
