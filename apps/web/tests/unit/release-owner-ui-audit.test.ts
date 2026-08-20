import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const auditPath = resolve(process.cwd(), "../../artifacts/release-0.3.0-owner-data-ui-audit.json");

describe("release owner UI audit", () => {
  it("propagates independent audit failures and blockers instead of reporting zero omissions", async () => {
    const audit = JSON.parse(await readFile(auditPath, "utf8")) as {
      schemaVersion: string;
      status: string;
      summary: { blockedFormAuditCount: number; blockedTableAuditCount: number; independentlyPassingGenericFormCount: number; independentlyPassingGenericTableCount: number };
      hardFailures: { missingIndependentFormContracts: string[]; missingIndependentTableContracts: string[]; unverifiedRelationPresentation: string[] };
    };
    expect(audit.schemaVersion).toBe("echoes-release-0.3.0-owner-data-ui-audit-v2");
    expect(audit.status).toBe("BLOCKED");
    expect(audit.summary.independentlyPassingGenericFormCount).toBe(34);
    expect(audit.summary.independentlyPassingGenericTableCount).toBe(34);
    expect(audit.summary.blockedFormAuditCount).toBeGreaterThan(0);
    expect(audit.summary.blockedTableAuditCount).toBeGreaterThan(0);
    expect(audit.hardFailures.missingIndependentFormContracts.length).toBeGreaterThan(0);
    expect(audit.hardFailures.missingIndependentTableContracts.length + audit.hardFailures.unverifiedRelationPresentation.length).toBeGreaterThan(0);
  });
});
