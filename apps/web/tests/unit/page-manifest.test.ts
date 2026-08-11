import { describe, expect, it } from "vitest";

import {
  basePageManifest,
  excludedV3ScreenIds,
  manifestByShell,
  pageManifest,
  screenForPath,
  v3PageManifestAdditions,
} from "../../src/lib/page-manifest";

describe("active page manifest", () => {
  it("derives the active inventory from the locked base and V3 amendments", () => {
    const expected = basePageManifest.length - excludedV3ScreenIds.length + v3PageManifestAdditions.length;
    expect(pageManifest).toHaveLength(expected);
    expect(new Set(pageManifest.map((entry) => entry.reviewOrder)).size).toBe(expected);
    expect(v3PageManifestAdditions.map((entry) => entry.screenId)).toEqual(["CAP01", "CAP02", "CAP03", "CAP04", "CAP05"]);
  });

  it("preserves the approved shell ownership counts", () => {
    const groups = manifestByShell();
    expect(groups.public).toHaveLength(36);
    expect(groups.auth).toHaveLength(10);
    expect(groups.account).toHaveLength(23);
    expect(groups.store).toHaveLength(12);
    expect(groups.admin).toHaveLength(156);
    expect(groups.game).toHaveLength(14);
    expect(groups["tools-review"]).toHaveLength(5);
    expect(groups["state-only"]).toHaveLength(18);
  });

  it("prefers a static V3 route over the dynamic capability editor", () => {
    expect(screenForPath("/admin/capabilities/scoring")?.screenId).toBe("CAP04");
    expect(screenForPath("/admin/capabilities/DEF-1")?.screenId).toBe("CAP02");
  });
});
