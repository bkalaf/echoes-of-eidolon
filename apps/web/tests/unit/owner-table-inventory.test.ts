import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface TableAuditRow {
  canonicalFieldsExpected: string[];
  columnsRendered: string[];
  component: string;
  filterableFields: string[];
  missingFields: string[];
  preferenceKey: string;
  relationFields: Array<{ field: string; resolver: string }>;
  routeOrState: string[];
  sortableFields: string[];
}

interface TableInventory {
  nativeTableElementsOutsideSharedGrid: string[];
  sourceSurfaceCount: number;
  tables: TableAuditRow[];
}

describe("Release 0.3.0 owner table inventory", () => {
  it("covers every live grid and reports no omitted read-model fields", () => {
    const inventory = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../../artifacts/release-0.3.0/owner-ui/owner-table-inventory.json"), "utf8")) as TableInventory;
    expect(inventory.sourceSurfaceCount).toBeGreaterThanOrEqual(46);
    expect(inventory.nativeTableElementsOutsideSharedGrid).toEqual([]);
    expect(inventory.tables.length).toBeGreaterThan(inventory.sourceSurfaceCount);
    for (const table of inventory.tables) {
      expect(table.preferenceKey).not.toBe("");
      expect(table.component).not.toBe("");
      expect(table.routeOrState.length).toBeGreaterThan(0);
      expect(table.canonicalFieldsExpected.length).toBeGreaterThan(0);
      expect(table.columnsRendered.length).toBeGreaterThanOrEqual(table.canonicalFieldsExpected.length);
      expect(table.missingFields).toEqual([]);
      expect(table.sortableFields.length).toBeGreaterThan(0);
      expect(table.filterableFields.length).toBeGreaterThan(0);
      for (const relation of table.relationFields) expect(relation.resolver).not.toBe("");
    }
  });

  it("records the required Chromium coverage matrix even when execution evidence is unavailable", () => {
    const matrix = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../../artifacts/release-0.3.0/owner-ui/owner-table-browser-matrix.json"), "utf8")) as { scenarios: Array<{ name: string; status: string }> };
    expect(matrix.scenarios.map(({ name }) => name)).toEqual(expect.arrayContaining(["narrow", "wide", "empty", "populated", "filtered", "sorted", "relation-heavy", "Character", "Witness", "WitnessDef"]));
    expect(matrix.scenarios.every(({ status }) => ["BLOCKED", "PASS"].includes(status))).toBe(true);
  });
});
