import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  categoryForCommitType,
  releaseEntryFromCommit,
  renderGeneratedDraft,
  validateProspectiveCommit,
  writeGeneratedDraft,
} from "../../src/server/release-notes-git";

describe("release draft generation", () => {
  it("RN-016 exposes only approved footer content", () => {
    const entry = releaseEntryFromCommit({ subject: "fix(auth): preserve session", body: "Internal debugging details\n\nRelease-Note: Returning home keeps the active session.\nRelease-Audience: PLAYERS" });
    expect(entry?.body).toBe("Returning home keeps the active session.");
    expect(JSON.stringify(entry)).not.toContain("Internal debugging details");
  });

  it("RN-017 parses a valid release footer", () => {
    expect(releaseEntryFromCommit({ subject: "fix(auth): preserve session", body: "Release-Note: Returning home no longer ends an active session.\nRelease-Audience: PLAYERS" })).toMatchObject({ audience: "PLAYERS", category: "FIXED" });
  });

  it("RN-018 omits Release-Note none", () => {
    expect(releaseEntryFromCommit({ subject: "test(auth): add coverage", body: "Release-Note: none" })).toBeNull();
  });

  it.each(["PLAYERS", "OPERATORS", "BOTH"] as const)("RN-019 parses the %s audience", (audience) => {
    expect(releaseEntryFromCommit({ subject: "feat(web): add behavior", body: `Release-Note: A readable change.\nRelease-Audience: ${audience}` })?.audience).toBe(audience);
  });

  it("RN-020 maps conventional categories", () => {
    expect(categoryForCommitType("feat")).toBe("ADDED");
    expect(categoryForCommitType("fix")).toBe("FIXED");
    expect(categoryForCommitType("perf")).toBe("CHANGED");
    expect(categoryForCommitType("security")).toBe("SECURITY");
  });

  it("RN-021 never overwrites a canonical note", () => {
    const root = mkdtempSync(join(tmpdir(), "eidolon-release-draft-"));
    const canonicalPath = join(root, "0_2_0.md");
    const draftPath = join(root, ".drafts", "0_2_0.generated.md");
    writeFileSync(canonicalPath, "reviewed canonical note", "utf8");
    writeGeneratedDraft({ canonicalPath, draftPath, markdown: "generated draft" });
    expect(readFileSync(canonicalPath, "utf8")).toBe("reviewed canonical note");
    expect(readFileSync(draftPath, "utf8")).toBe("generated draft");
  });

  it("RN-022 generates review-only DRAFT content", () => {
    const markdown = renderGeneratedDraft("0.2.0", [{ audience: "BOTH", body: "A readable change.", category: "ADDED", title: "Add behavior" }]);
    expect(markdown).toContain("status: DRAFT");
    expect(markdown).toContain("releaseDate: null");
    expect(markdown).not.toMatch(/PUBLISHED|git tag|GitHub Release|deploy/i);
  });

  it("enforces the prospective commit footer without rewriting old history", () => {
    expect(() => validateProspectiveCommit({ subject: "feat(web): add behavior", body: "Implementation details" })).toThrow(/Release-Note/);
    expect(() => validateProspectiveCommit({ subject: "chore(release): maintain gate", body: "Release-Note: none" })).not.toThrow();
  });
});
