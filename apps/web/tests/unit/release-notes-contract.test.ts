import { describe, expect, it } from "vitest";

import {
  assertPublicReleaseNoteContent,
  compareSemanticVersions,
  releaseNotesSchema,
  semanticVersionSchema,
} from "../../src/domain/release-notes";

const item = {
  itemId: "0.2.0:added:1",
  category: "ADDED" as const,
  title: "Branching conversations",
  body: "Players can explore branching conversations.",
  audience: "PLAYERS" as const,
};

describe("canonical release-note contract", () => {
  it("RN-001 validates strict semantic versions", () => {
    for (const version of ["0.2.0", "1.0.0", "0.10.3"]) expect(semanticVersionSchema.safeParse(version).success).toBe(true);
    for (const version of ["0.2", "v0.2.0", "0.02.0", "1.0.0-beta", "one.two.three"]) expect(semanticVersionSchema.safeParse(version).success).toBe(false);
  });

  it("RN-002 sorts semantic versions numerically", () => {
    expect(compareSemanticVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
  });

  it("RN-005 enforces a null DRAFT date", () => {
    expect(releaseNotesSchema.safeParse({ version: "0.2.0", status: "DRAFT", title: "Release", summary: "Summary", releaseDate: null, previousVersion: null, items: [item] }).success).toBe(true);
    expect(releaseNotesSchema.safeParse({ version: "0.2.0", status: "DRAFT", title: "Release", summary: "Summary", releaseDate: "2026-08-11", previousVersion: null, items: [item] }).success).toBe(false);
  });

  it("RN-006 requires a valid PUBLISHED date", () => {
    expect(releaseNotesSchema.safeParse({ version: "0.2.0", status: "PUBLISHED", title: "Release", summary: "Summary", releaseDate: "2026-08-11", previousVersion: null, items: [item] }).success).toBe(true);
    expect(releaseNotesSchema.safeParse({ version: "0.2.0", status: "PUBLISHED", title: "Release", summary: "Summary", releaseDate: null, previousVersion: null, items: [item] }).success).toBe(false);
    expect(releaseNotesSchema.safeParse({ version: "0.2.0", status: "PUBLISHED", title: "Release", summary: "Summary", releaseDate: "2026-02-31", previousVersion: null, items: [item] }).success).toBe(false);
  });

  it("RN-012 rejects hidden branching", () => {
    expect(() => assertPublicReleaseNoteContent("The hidden branching structure is now visible.")).toThrow(/hidden branching/i);
  });

  it("RN-013 accepts player-readable branching", () => {
    expect(() => assertPublicReleaseNoteContent("Players can explore branching conversations.")).not.toThrow();
  });

  it("RN-014 rejects hidden architecture terminology", () => {
    for (const value of ["WorldKey", "CONCORD world", "EIDOLON_ATLAS_RECON_NIMBUS"]) expect(() => assertPublicReleaseNoteContent(value)).toThrow();
  });

  it("RN-015 rejects sensitive and internal information", () => {
    for (const value of ["sk_live_example", "private issue #123", "provider cus_123", "/home/operator/release"]) expect(() => assertPublicReleaseNoteContent(value)).toThrow();
  });
});
