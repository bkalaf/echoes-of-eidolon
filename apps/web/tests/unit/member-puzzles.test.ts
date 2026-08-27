import { describe, expect, it } from "vitest";

import {
  getMemberPuzzle,
  getMemberPuzzleCatalog,
  resolveMemberPuzzleRoute,
  validateMemberPuzzleSubmission,
} from "../../src/server/member-puzzles";
import { revealProductionPreviewSolution } from "../../src/server/puzzle-production-validation";

const secret = "member-puzzle-test-secret-000000000000000000000000";
const userId = "member-puzzle-user";

describe("Member puzzle service", () => {
  it("publishes exactly four non-spoiling public identities", () => {
    expect(getMemberPuzzleCatalog()).toEqual([
      expect.objectContaining({ publicSlug: "quiet-accord", publicTitle: "The Quiet Accord" }),
      expect.objectContaining({ publicSlug: "third-reading", publicTitle: "The Third Reading" }),
      expect.objectContaining({ publicSlug: "the-pall", publicTitle: "The Pall" }),
      expect.objectContaining({ publicSlug: "glass-vespers", publicTitle: "Glass Vespers" }),
    ]);
    expect(JSON.stringify(getMemberPuzzleCatalog())).not.toMatch(/PZB-|generator|production|prototype/i);
  });

  it("returns deterministic answer-free player payloads without internal discriminants", () => {
    for (const summary of getMemberPuzzleCatalog()) {
      const first = getMemberPuzzle(summary.publicSlug, userId, secret);
      const replay = getMemberPuzzle(summary.publicSlug, userId, secret);
      expect(replay).toEqual(first);
      const serialized = JSON.stringify(first);
      expect(serialized).not.toMatch(/PZB-|Ordinal Cancellation|Set Union|Typographic QR|Musical Hexadecimal/i);
      expect(serialized).not.toMatch(/(?:generatorVersion|instanceId|canonicalSolution|proofDigest|checksum|expectedSolvePath|seed|subjectKey|carrier|kind)/i);
    }
  });

  it("does not resolve internal or prototype identifiers as Member slugs", () => {
    expect(() => getMemberPuzzle("PZB-011", userId, secret)).toThrow(/not found/i);
    expect(() => getMemberPuzzle("PZB-001", userId, secret)).toThrow(/not found/i);
    expect(() => getMemberPuzzle("unknown", userId, secret)).toThrow(/not found/i);
  });

  it("validates the same deterministic instance used by the Member renderer", () => {
    const quiet = getMemberPuzzle("quiet-accord", userId, secret);
    const solution = revealProductionPreviewSolution("PZB-011", 0, secret);
    expect(quiet.publicSlug).toBe("quiet-accord");
    expect(validateMemberPuzzleSubmission("quiet-accord", userId, { kind: "bitmap-code", markedCoordinates: [], value: solution.expectedSolution }, secret).correct).toBe(false);

    expect(() => resolveMemberPuzzleRoute("quiet-accord", userId, 128, secret)).toThrow(/not available/i);
  });
});
