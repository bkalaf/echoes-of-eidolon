import { describe, expect, it } from "vitest";

import { resolveBuildGitSha, resolveBuildVersion } from "../../src/server/releases";

const revision = "0123456789abcdef0123456789abcdef01234567";

describe("build identity", () => {
  it("prefers the exact revision embedded by the deployment build", () => {
    expect(resolveBuildGitSha(revision, "fedcba9876543210fedcba9876543210fedcba98")).toBe(revision);
  });

  it("accepts an exact runtime fallback for non-deployment builds", () => {
    expect(resolveBuildGitSha(undefined, revision)).toBe(revision);
  });

  it("rejects non-exact or missing revisions", () => {
    expect(resolveBuildGitSha("main", "short")).toBeNull();
    expect(resolveBuildGitSha(undefined, undefined)).toBeNull();
  });

  it("reports the embedded application package version independently of the published release index", () => {
    expect(resolveBuildVersion("0.3.0", "0.2.1")).toBe("0.3.0");
    expect(resolveBuildVersion(undefined, "0.2.1")).toBe("0.2.1");
  });
});
