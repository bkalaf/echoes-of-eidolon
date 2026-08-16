import { describe, expect, it } from "vitest";

import {
  createDefaultFieldMapping,
  parseEntityImport,
  prepareEntityImport,
} from "../../src/domain/entity-import";

describe("entity import parsing", () => {
  it("parses JSON and YAML record arrays", () => {
    expect(parseEntityImport('[{"soulId":"SOUL-1","name":"One"}]', "records.json")).toEqual([
      { soulId: "SOUL-1", name: "One" },
    ]);
    expect(parseEntityImport("- soulId: SOUL-2\n  name: Two\n", "records.yaml")).toEqual([
      { soulId: "SOUL-2", name: "Two" },
    ]);
  });

  it("parses Markdown tables including escaped delimiters", () => {
    expect(parseEntityImport("| definitionId | term | definition |\n| --- | --- | --- |\n| DEF-1 | Signal\\|Lost | Source-backed |", "records.md")).toEqual([
      { definitionId: "DEF-1", term: "Signal|Lost", definition: "Source-backed" },
    ]);
  });

  it("parses HTML tables as inert text records", () => {
    expect(parseEntityImport("<table><thead><tr><th>soulId</th><th>name</th></tr></thead><tbody><tr><td>SOUL-3</td><td>Three</td></tr></tbody></table>", "records.html")).toEqual([
      { soulId: "SOUL-3", name: "Three" },
    ]);
  });

  it("rejects unsupported files, ambiguous tables, and non-record rows", () => {
    expect(() => parseEntityImport("x", "records.txt")).toThrow("Unsupported import format");
    expect(() => parseEntityImport("| id | id |\n| --- | --- |\n| 1 | 2 |", "records.md")).toThrow("Duplicate Markdown header");
    expect(() => parseEntityImport("<table></table><table></table>", "records.html")).toThrow("exactly one table");
    expect(() => parseEntityImport("<table><tr><th rowspan='2'>id</th></tr><tr><td>1</td></tr></table>", "records.html")).toThrow("merged table cells");
    expect(() => parseEntityImport('["not a record"]', "records.json")).toThrow("must be an object");
  });
});

describe("entity import mapping and preview", () => {
  it("maps exact fields by default and requires explicit handling for unknown fields", () => {
    const rows = [{ incomingId: "SOUL-1", name: "One", unknown: "blocked" }];
    const mapping = createDefaultFieldMapping("Soul", rows);
    expect(mapping).toEqual({ incomingId: undefined, name: "name", unknown: undefined });

    const blocked = prepareEntityImport("Soul", rows, mapping);
    expect(blocked.errors).toContain("Source field incomingId must be mapped or ignored.");
    expect(blocked.errors).toContain("Source field unknown must be mapped or ignored.");
  });

  it("rejects duplicate target mappings, missing IDs, and duplicate IDs", () => {
    const duplicateTarget = prepareEntityImport(
      "Soul",
      [{ first: "SOUL-1", second: "One" }],
      { first: "soulId", second: "soulId" },
    );
    expect(duplicateTarget.errors).toContain("Target field soulId is mapped more than once.");

    const missingId = prepareEntityImport("Soul", [{ soulId: "", name: "One" }], {
      soulId: "soulId",
      name: "name",
    });
    expect(missingId.errors).toContain("Row 1 requires soulId.");

    const duplicateId = prepareEntityImport(
      "Soul",
      [
        { soulId: "SOUL-1", name: "One" },
        { soulId: "SOUL-1", name: "Again" },
      ],
      { soulId: "soulId", name: "name" },
    );
    expect(duplicateId.errors).toContain("Row 2 duplicates soulId SOUL-1.");
  });

  it("creates a concrete preview without mutating the source rows", () => {
    const source = [{ legacy_id: "SOUL-1", label: "One", ignored: "x" }];
    const preview = prepareEntityImport("Soul", source, {
      legacy_id: "soulId",
      label: "name",
      ignored: null,
    });

    expect(preview.errors).toEqual([]);
    expect(preview.rows).toEqual([{ soulId: "SOUL-1", name: "One" }]);
    expect(source).toEqual([{ legacy_id: "SOUL-1", label: "One", ignored: "x" }]);
  });

  it("preserves canonical persistence IDs instead of regenerating them from display labels", () => {
    const source = [{ speciesId: "SPC_HOMO_SAPIENS", name: "Human" }];
    const preview = prepareEntityImport("Species", source, {
      speciesId: "speciesId",
      name: "name",
    });

    expect(preview.rows).toEqual(source);
    expect(preview.errors).toEqual([]);
  });

  it("rejects malformed canonical persistence IDs without allocating a replacement", () => {
    const source = [{ speciesId: "species-human", name: "Human" }];
    const preview = prepareEntityImport("Species", source, {
      speciesId: "speciesId",
      name: "name",
    });

    expect(preview.rows).toEqual(source);
    expect(preview.errors).toContain("Row 1 speciesId must use canonical SPC_* SCREAMING_SNAKE_CASE form.");
  });
});
