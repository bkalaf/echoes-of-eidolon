import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../..");
const schema = readFileSync(resolve(webRoot, "prisma/schema.prisma"), "utf8");
const canonicalMigrationPath = resolve(webRoot, "prisma/migrations/20260816000000_architect_witness_guide_canon/migration.sql");
const remediationMigrationPath = resolve(webRoot, "prisma/migrations/20260816003000_bulk_api_and_document_bucket_remediation/migration.sql");
const model = (name: string) => schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";

describe("Architect Witness Guide canonical persistence", () => {
  it("supports non-biological Characters and owner-authored Witness definitions", () => {
    const character = model("Character");
    const witnessDef = model("WitnessDef");
    expect(character).toMatch(/breedId\s+String\?/);
    expect(character).toMatch(/breed\s+Breed\?/);
    expect(witnessDef).toMatch(/color\s+Json/);
    expect(witnessDef).toMatch(/architectSoulId\s+String/);
    expect(witnessDef).toMatch(/architectSoul\s+Soul/);
    expect(schema).not.toMatch(/enum WitnessColor/);
  });

  it("adds forward migrations for canonical definitions and exact Bulk API states", () => {
    expect(existsSync(canonicalMigrationPath)).toBe(true);
    expect(existsSync(remediationMigrationPath)).toBe(true);
    if (!existsSync(canonicalMigrationPath) || !existsSync(remediationMigrationPath)) return;
    const canonicalMigration = readFileSync(canonicalMigrationPath, "utf8");
    const remediationMigration = readFileSync(remediationMigrationPath, "utf8");
    expect(canonicalMigration).toContain('ADD COLUMN "architectSoulId" TEXT NOT NULL');
    expect(canonicalMigration).toContain('ALTER COLUMN "breedId" DROP NOT NULL');
    expect(remediationMigration).toContain('"state" = \'KEYLESS\'');
    expect(remediationMigration).toContain('"keyHash" IS NULL');
    expect(remediationMigration).toContain('"state" = \'KEYED\'');
    expect(remediationMigration).toContain('length("keyHash") = 64');
  });

  it("removes empty unauthorized DocumentBucket persistence without inventing a replacement", () => {
    for (const name of ["DocumentBucket", "DocumentSourcePoint", "DocumentAmendment", "DocumentDraft"]) {
      expect(model(name), name).toBe("");
    }
    expect(schema).not.toMatch(/enum DocumentDraftStatus/);
  });

  it("fails closed before dropping superseded Document persistence when any row exists", () => {
    const remediationMigration = readFileSync(remediationMigrationPath, "utf8");
    expect(remediationMigration).toContain('Refusing to remove superseded DocumentBucket persistence because Document* rows exist');
    const guardIndex = remediationMigration.indexOf('Refusing to remove superseded DocumentBucket persistence');
    for (const table of ["DocumentBucket", "DocumentSourcePoint", "DocumentAmendment", "DocumentDraft"]) {
      expect(remediationMigration.indexOf(`SELECT 1 FROM "${table}"`), table).toBeGreaterThanOrEqual(0);
      expect(guardIndex, `${table} guard must precede destructive statements`).toBeLessThan(remediationMigration.indexOf(`DROP TABLE "${table}"`));
    }
  });
});
