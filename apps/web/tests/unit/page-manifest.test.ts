import { describe, expect, it } from "vitest";

import { manifestByShell, pageManifest } from "../../src/lib/page-manifest";

describe("active page manifest", () => {
  it("contains the exact 269-screen review inventory", () => {
    expect(pageManifest).toHaveLength(269);
    expect(new Set(pageManifest.map((entry) => entry.reviewOrder)).size).toBe(269);
  });

  it("preserves the approved shell ownership counts", () => {
    const groups = manifestByShell();
    expect(groups.public).toHaveLength(36);
    expect(groups.auth).toHaveLength(10);
    expect(groups.account).toHaveLength(23);
    expect(groups.store).toHaveLength(12);
    expect(groups.admin).toHaveLength(151);
    expect(groups.game).toHaveLength(14);
    expect(groups["tools-review"]).toHaveLength(5);
    expect(groups["state-only"]).toHaveLength(18);
  });
});
