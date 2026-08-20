import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const artifactRoot = resolve(process.cwd(), "../../artifacts/release-0.3.0/owner-ui");

describe("owner form inventory artifacts", () => {
  it("independently verifies generic entity forms and blocks bespoke editors without write contracts", async () => {
    const inventory = JSON.parse(await readFile(resolve(artifactRoot, "owner-form-inventory.json"), "utf8")) as {
      schemaVersion: string;
      status: string;
      genericForms: Array<{ auditStatus: string; canonicalFields: string[]; missingFields: string[]; relationLookups: Array<{ foreignKey: string; presentationRule: string }>; violations: string[] }>;
      sourceEditors: Array<{ auditBlockers: string[]; auditStatus: string; canonicalFields: string[]; contractEvidence: unknown }>;
    };
    expect(inventory.schemaVersion).toBe("echoes-owner-form-inventory-v3");
    expect(inventory.status).toBe("BLOCKED");
    expect(inventory.genericForms).toHaveLength(35);
    expect(inventory.genericForms.every(({ auditStatus, canonicalFields, missingFields, violations }) => auditStatus === "LOCAL_INDEPENDENT_CONTRACT_PASS" && canonicalFields.length > 0 && missingFields.length === 0 && violations.length === 0)).toBe(true);
    expect(inventory.genericForms.flatMap(({ relationLookups }) => relationLookups).every(({ presentationRule }) => presentationRule === "human-readable label + canonical ID")).toBe(true);
    expect(inventory.sourceEditors.length).toBeGreaterThan(10);
    expect(inventory.sourceEditors.every(({ auditBlockers, auditStatus, canonicalFields, contractEvidence }) => auditStatus === "BLOCKED_MISSING_INDEPENDENT_WRITE_CONTRACT" && auditBlockers.length > 0 && canonicalFields.length === 0 && contractEvidence === null)).toBe(true);
  });

  it("retains the mandatory browser scenarios without claiming blocked Chromium runs", async () => {
    const matrix = JSON.parse(await readFile(resolve(artifactRoot, "owner-form-browser-matrix.json"), "utf8")) as { scenarios: Array<{ name: string; status: string }> };
    expect(matrix.scenarios.map(({ name }) => name)).toEqual(expect.arrayContaining(["Character", "Architect", "WitnessDef", "Witness", "CompanionDef", "Companion", "Breed", "Species", "Culture", "unrelated-generic-entities"]));
    expect(matrix.scenarios.every(({ status }) => status === "BLOCKED")).toBe(true);
  });
});
