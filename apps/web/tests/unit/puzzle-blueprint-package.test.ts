import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PUZZLE_BLUEPRINT_PACKAGE_HEADERS,
  PUZZLE_BLUEPRINT_PACKAGE_SHA256,
  parsePuzzleBlueprintPackageCsv,
} from "../../src/domain/puzzle-blueprint-package";

const source = readFileSync(resolve(import.meta.dirname, "../../data/puzzles/puzzle-blueprint-bank-70.csv"), "utf8");

describe("Puzzle Blueprint package", () => {
  it("keeps the approved 70-row source byte-identical and schema-complete", () => {
    expect(createHash("sha256").update(source).digest("hex")).toBe(PUZZLE_BLUEPRINT_PACKAGE_SHA256);
    const rows = parsePuzzleBlueprintPackageCsv(source);
    expect(rows).toHaveLength(70);
    expect(rows[0]?.puzzleBlueprintId).toBe("PZB-001");
    expect(rows[69]?.puzzleBlueprintId).toBe("PZB-070");
    expect(Object.keys(rows[0] ?? {})).toEqual(PUZZLE_BLUEPRINT_PACKAGE_HEADERS);
    expect(rows.every((row) => row.hintLevel1 && row.hintLevel2)).toBe(true);
  });

  it("rejects reordered or missing columns instead of guessing a mapping", () => {
    expect(() => parsePuzzleBlueprintPackageCsv(source.replace("puzzleBlueprintId,title", "title,puzzleBlueprintId"))).toThrow(/column 1/);
  });
});

