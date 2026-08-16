import { describe, expect, it } from "vitest";

import {
  basePageManifest,
  excludedV3ScreenIds,
  manifestByShell,
  pageManifest,
  pathMatches,
  screenForPath,
  v3PageManifestAdditions,
  v4PageManifestAdditions,
} from "../../src/lib/page-manifest";

describe("active page manifest", () => {
  it("derives the active inventory from the locked base and V3 amendments", () => {
    const expected = basePageManifest.length - excludedV3ScreenIds.length + v3PageManifestAdditions.length + v4PageManifestAdditions.length;
    expect(pageManifest).toHaveLength(expected);
    expect(new Set(pageManifest.map((entry) => entry.reviewOrder)).size).toBe(expected);
    expect(v3PageManifestAdditions.map((entry) => entry.screenId)).toEqual(["CAP01", "CAP02", "CAP03", "CAP04", "CAP05", "CAM006", "CAM007", "ACC024"]);
    expect([...excludedV3ScreenIds]).toEqual(["DATA027", "DATA_MATRIX_EDIT", "DATA_MATRIX_IMPORT", "DATA_ANTAGONIST_TABLE", "DATA001", "DATA006", "DATA_ANTAGONIST_NEW", "DATA_PROTAGONIST_EDIT", "DATA_ANTAGONIST_IMPORT", "DATA_PROTAGONIST_IMPORT", "DATA023", "DATA_SPECIESGROUP_EDIT", "DATA_SPECIESGROUP_IMPORT"]);
    expect(pageManifest).toHaveLength(basePageManifest.length - 13 + 8 + 28);
  });

  it("adds the complete V4 implementation package without renumbering historical rows", () => {
    expect(v4PageManifestAdditions).toHaveLength(28);
    expect(v4PageManifestAdditions[0]?.reviewOrder).toBe(278);
    expect(v4PageManifestAdditions.at(-1)?.reviewOrder).toBe(305);
    expect(v4PageManifestAdditions.map((entry) => entry.screenId)).toContain("PUB_GAME02_WORLD_ATLAS");
    expect(v4PageManifestAdditions.map((entry) => entry.screenId)).toContain("ADM_AUDIO01_SETTLEMENT_SOUNDTRACKS");
    expect(v4PageManifestAdditions.map((entry) => entry.screenId)).toEqual(expect.arrayContaining(["DATA_WITNESS_DEF", "DATA_COMPANION_DEF"]));
    expect(v4PageManifestAdditions.map((entry) => entry.screenId)).toEqual(expect.arrayContaining(["CAMPAIGN_DOCUMENT_CORPUS", "CAMPAIGN_DOCUMENT_QUESTS"]));
    expect(pageManifest).toHaveLength(basePageManifest.length - 13 + 8 + 28);
  });

  it("preserves the approved shell ownership counts", () => {
    const groups = manifestByShell();
    expect(groups.public).toHaveLength(39);
    expect(groups.auth).toHaveLength(10);
    expect(groups.account).toHaveLength(26);
    expect(groups.store).toHaveLength(12);
    expect(groups.admin).toHaveLength(156);
    expect(groups.game).toHaveLength(40);
    expect(groups["tools-review"]).toHaveLength(9);
    expect(groups["state-only"]).toHaveLength(0);
  });

  it("prefers a static V3 route over the dynamic capability editor", () => {
    expect(screenForPath("/admin/capabilities/scoring")?.screenId).toBe("CAP04");
    expect(screenForPath("/admin/capabilities/DEF-1")?.screenId).toBe("CAP02");
  });

  it("treats reviewed sample-record editor identities as actual record route parameters", () => {
    expect(pathMatches("/admin/data/soul/sample-record", "/admin/data/soul/SOUL-001")).toBe(true);
    expect(screenForPath("/admin/data/soul/SOUL-001")?.screenId).toBe("DATA_SOUL_EDIT");
  });
});
