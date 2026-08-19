import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const artifactRoot = resolve(process.cwd(), "../../artifacts/release-0.3.0/owner-ui");

describe("owner form inventory artifacts", () => {
  it("records every generic entity field and relation contract with zero omissions", async () => {
    const inventory = JSON.parse(await readFile(resolve(artifactRoot, "owner-form-inventory.json"), "utf8")) as {
      schemaVersion: string;
      genericForms: Array<{ canonicalFields: string[]; missingFields: string[]; relationLookups: Array<{ foreignKey: string; presentationRule: string }> }>;
      sourceEditors: Array<{ auditStatus: string; missingFields: string[]; relationLookupPresentation: Array<{ presentationRule: string; reviewStatus: string }> }>;
    };
    expect(inventory.schemaVersion).toBe("echoes-owner-form-inventory-v2");
    expect(inventory.genericForms).toHaveLength(34);
    expect(inventory.genericForms.every(({ canonicalFields, missingFields }) => canonicalFields.length > 0 && missingFields.length === 0)).toBe(true);
    expect(inventory.genericForms.flatMap(({ relationLookups }) => relationLookups).every(({ presentationRule }) => presentationRule === "human-readable label + canonical ID")).toBe(true);
    expect(inventory.sourceEditors.length).toBeGreaterThan(10);
    expect(inventory.sourceEditors.every(({ auditStatus, missingFields }) => auditStatus === "REVIEWED_COMPLETE" && missingFields.length === 0)).toBe(true);
    expect(inventory.sourceEditors.flatMap(({ relationLookupPresentation }) => relationLookupPresentation).every(({ presentationRule, reviewStatus }) => presentationRule.length > 0 && reviewStatus === "PASS")).toBe(true);
  });

  it("retains the mandatory browser scenarios without claiming blocked Chromium runs", async () => {
    const matrix = JSON.parse(await readFile(resolve(artifactRoot, "owner-form-browser-matrix.json"), "utf8")) as { scenarios: Array<{ name: string; status: string }> };
    expect(matrix.scenarios.map(({ name }) => name)).toEqual(expect.arrayContaining(["Character", "Architect", "WitnessDef", "Witness", "CompanionDef", "Companion", "Breed", "Species", "Culture", "unrelated-generic-entities"]));
    expect(matrix.scenarios.every(({ status }) => status === "BLOCKED")).toBe(true);
  });
});
