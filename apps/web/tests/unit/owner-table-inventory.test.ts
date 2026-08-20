import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface TableAuditRow {
  auditBlockers: string[];
  auditStatus: string;
  canonicalFieldsExpected: string[];
  columnsRendered: string[];
  component: string;
  filterableFields: string[];
  missingFields: string[];
  preferenceKey: string;
  relationFields: Array<{ field: string; resolver: string }>;
  routeOrState: string[];
  sortableFields: string[];
  violations: string[];
}

interface TableInventory {
  nativeTableElementsOutsideSharedGrid: string[];
  schemaVersion: string;
  sourceSurfaceCount: number;
  status: string;
  tables: TableAuditRow[];
}

describe("Release 0.3.0 owner table inventory", () => {
  it("independently audits generic grids and blocks source grids without read contracts", () => {
    const inventory = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../../artifacts/release-0.3.0/owner-ui/owner-table-inventory.json"), "utf8")) as TableInventory;
    expect(inventory.schemaVersion).toBe("echoes-owner-table-inventory-v2");
    expect(inventory.status).toBe("BLOCKED");
    expect(inventory.sourceSurfaceCount).toBeGreaterThanOrEqual(46);
    expect(inventory.nativeTableElementsOutsideSharedGrid).toEqual([]);
    expect(inventory.tables.length).toBeGreaterThan(inventory.sourceSurfaceCount);
    const genericTables = inventory.tables.filter(({ component }) => component === "EntityRecordsAdminPage");
    expect(genericTables).toHaveLength(35);
    for (const table of genericTables) {
      expect(table.auditStatus).toBe("LOCAL_INDEPENDENT_CONTRACT_PASS");
      expect(table.auditBlockers).toEqual([]);
      expect(table.preferenceKey).not.toBe("");
      expect(table.component).not.toBe("");
      expect(table.routeOrState.length).toBeGreaterThan(0);
      expect(table.canonicalFieldsExpected.length).toBeGreaterThan(0);
      expect(table.columnsRendered.length).toBeGreaterThanOrEqual(table.canonicalFieldsExpected.length);
      expect(table.missingFields).toEqual([]);
      expect(table.sortableFields.length).toBeGreaterThan(0);
      expect(table.filterableFields.length).toBeGreaterThan(0);
      expect(table.violations).toEqual([]);
      for (const relation of table.relationFields) expect(relation.resolver).not.toBe("");
    }
    const sourceTables = inventory.tables.filter(({ component }) => component !== "EntityRecordsAdminPage");
    expect(sourceTables.length).toBeGreaterThan(0);
    expect(sourceTables.every(({ auditBlockers, auditStatus }) => auditStatus === "LOCAL_INDEPENDENT_CONTRACT_PASS" || auditStatus === "FAIL" || auditStatus.startsWith("BLOCKED_") && auditBlockers.length > 0)).toBe(true);
    expect(sourceTables.some(({ auditStatus }) => auditStatus === "BLOCKED_MISSING_INDEPENDENT_READ_CONTRACT")).toBe(true);
  });

  it("records the required Chromium coverage matrix even when execution evidence is unavailable", () => {
    const matrix = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../../artifacts/release-0.3.0/owner-ui/owner-table-browser-matrix.json"), "utf8")) as { scenarios: Array<{ name: string; status: string }> };
    expect(matrix.scenarios.map(({ name }) => name)).toEqual(expect.arrayContaining(["narrow", "wide", "empty", "populated", "filtered", "sorted", "relation-heavy", "Character", "Witness", "WitnessDef"]));
    expect(matrix.scenarios.every(({ status }) => ["BLOCKED", "PASS"].includes(status))).toBe(true);
  });
});
