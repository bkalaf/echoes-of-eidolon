import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { entityFields, entityForPath } from "../../src/content/entities";
import { lookupPresentationFor } from "../../src/domain/lookup-presentation";
import { orderOwnerTableFields } from "../../src/domain/owner-table-field-order";
import contractData from "../../src/data/entity-admin-contract.json";

const webRoot = resolve(import.meta.dirname, "../..");
const repositoryRoot = resolve(webRoot, "../..");

describe("first-class relational Taxonomy", () => {
  it("owns canonical TAX rows and a nullable Species foreign key without legacy JSON", () => {
    const schema = readFileSync(resolve(webRoot, "prisma/schema.prisma"), "utf8");
    const taxonomyModel = /model Taxonomy\s*\{([\s\S]*?)^\}/m.exec(schema)?.[1] ?? "";
    const speciesModel = /model Species\s*\{([\s\S]*?)^\}/m.exec(schema)?.[1] ?? "";
    expect(taxonomyModel).toContain("taxonomyLevelId       String       @id");
    expect(taxonomyModel).toContain('@relation("TaxonomyHierarchy"');
    expect(speciesModel).toContain("taxonomyLevelId");
    expect(speciesModel).toContain("taxonomy                  Taxonomy?");
    expect(speciesModel).not.toMatch(/^\s*taxonomy\s+Json\?/m);
  });

  it("migrates fail-closed and removes JSON only after relational comparison", () => {
    const migration = readFileSync(resolve(webRoot, "prisma/migrations/20260820101500_taxonomy_relational_normalization/migration.sql"), "utf8");
    expect(migration).toContain("Taxonomy normalization found % unresolved canonical conflicts.");
    expect(migration).toContain("Taxonomy relational comparison detected field loss.");
    expect(migration.indexOf('Taxonomy relational comparison detected field loss.')).toBeLessThan(migration.indexOf('ALTER TABLE "Species" DROP COLUMN "taxonomy"'));
    expect(migration).toContain("TAX_GENUS_DRACO_MYTHOS");
  });

  it("registers readable Taxonomy administration and exact field order", () => {
    expect(entityFields.Taxonomy).toEqual(["taxonomyLevelId", "type", "name", "isOfficial", "text", "commonName", "parentTaxonomyLevelId"]);
    expect(entityForPath("/admin/data/taxonomy")).toBe("Taxonomy");
    expect(lookupPresentationFor("Taxonomy", { taxonomyLevelId: "TAX_CLASS_MAMMALIA", type: "CLASS", name: "Mammalia" })).toEqual({ primary: "Mammalia", technicalId: "TAX_CLASS_MAMMALIA", context: ["CLASS"] });
    const contract = contractData.entities.Taxonomy;
    expect(orderOwnerTableFields("Taxonomy", contract.idField, contract.auditFields).slice(0, 8).map(({ name }) => name)).toEqual([
      "name", "taxonomyLevelId", "type", "commonName", "parent", "parentTaxonomyLevelId", "isOfficial", "text",
    ]);
  });

  it("records the populated production-backup rehearsal with zero loss", () => {
    const audit = JSON.parse(readFileSync(resolve(repositoryRoot, "artifacts/taxonomy-relational-migration-final.json"), "utf8")) as {
      species: { before: number; after: number };
      taxonomy: { persistedNodes: number; unresolvedConflicts: number; cycles: unknown[] };
      speciesReferences: { matchingReferences: number };
      legacyJson: { fieldRemovedAfterSuccessfulAudit: boolean; dataLossDetected: boolean };
    };
    expect(audit.species).toMatchObject({ before: 1_131, after: 1_131 });
    expect(audit.taxonomy).toMatchObject({ persistedNodes: 2_616, unresolvedConflicts: 0, cycles: [] });
    expect(audit.speciesReferences.matchingReferences).toBe(1_131);
    expect(audit.legacyJson).toEqual({ fieldRemovedAfterSuccessfulAudit: true, dataLossDetected: false });
  });
});
