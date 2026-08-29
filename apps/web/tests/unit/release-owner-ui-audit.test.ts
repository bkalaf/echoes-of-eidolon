import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const auditPath = resolve(process.cwd(), "../../artifacts/release-0.3.0-owner-data-ui-audit.json");

describe("release owner UI audit", () => {
  it("reports the scoped generic owner-data result without laundering separate bespoke inventory gaps", async () => {
    const audit = JSON.parse(await readFile(auditPath, "utf8")) as {
      schemaVersion: string;
      status: string;
      summary: { blockedFormAuditCount: number; blockedTableAuditCount: number; independentlyPassingGenericFormCount: number; independentlyPassingGenericTableCount: number };
      blockers: string[];
      hardFailures: { missingColumns: string[]; missingFields: string[]; rawForeignKeysWithoutLookupLabels: string[]; relationsShowingIdWithoutHumanLabel: string[] };
      separateInventoryFindings: { missingIndependentFormContracts: string[]; missingIndependentTableContracts: string[]; unverifiedRelationPresentation: string[] };
    };
    expect(audit.schemaVersion).toBe("echoes-release-0.3.0-owner-data-ui-audit-v2");
    expect(audit.status).toBe("PASS");
    expect(audit.summary.independentlyPassingGenericFormCount).toBe(35);
    expect(audit.summary.independentlyPassingGenericTableCount).toBe(35);
    expect(audit.blockers).toEqual([]);
    expect(audit.hardFailures.missingColumns).toEqual([]);
    expect(audit.hardFailures.missingFields).toEqual([]);
    expect(audit.hardFailures.rawForeignKeysWithoutLookupLabels).toEqual([]);
    expect(audit.hardFailures.relationsShowingIdWithoutHumanLabel).toEqual([]);
    expect(audit.summary.blockedFormAuditCount).toBeGreaterThan(0);
    expect(audit.summary.blockedTableAuditCount).toBeGreaterThan(0);
    expect(audit.separateInventoryFindings.missingIndependentFormContracts.length).toBeGreaterThan(0);
    expect(audit.separateInventoryFindings.missingIndependentTableContracts.length + audit.separateInventoryFindings.unverifiedRelationPresentation.length).toBeGreaterThan(0);
  });
});
