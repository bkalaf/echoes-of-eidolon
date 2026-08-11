import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { validateReleaseState, runReleaseCheck } from "../../src/server/release-gate";

describe("release-note release gate", () => {
  it("RN-009 rejects root and web version drift", () => {
    expect(() => validateReleaseState({ rootVersion: "0.2.0", webVersion: "0.0.0", releases: [] })).toThrow(/version/i);
  });

  it("RN-010 requires the canonical current note", () => {
    expect(() => validateReleaseState({ rootVersion: "0.2.0", webVersion: "0.2.0", releases: [] })).toThrow(/canonical/i);
  });

  it("RN-011 verifies the prepared 0.2.0 repository state", async () => {
    await expect(runReleaseCheck(resolve(process.cwd(), "../.."))).resolves.toMatchObject({ currentVersion: "0.2.0", releaseDate: "2026-08-11", status: "PUBLISHED" });
  });
});
