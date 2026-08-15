import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const schemaPath = resolve(import.meta.dirname, "../../prisma/schema.prisma");
const migrationPath = resolve(import.meta.dirname, "../../prisma/migrations/20260814173000_companion_skill_nullability/migration.sql");

describe("companion skill participation nullability migration", () => {
  it("makes both skill assignments nullable without inventing or deleting authored values", () => {
    const schema = readFileSync(schemaPath, "utf8");
    const migration = readFileSync(migrationPath, "utf8");
    expect(schema).toMatch(/knowledgeSkill\s+KnowledgeSkill\?/);
    expect(schema).toMatch(/awarenessSkill\s+AwarenessSkill\?/);
    expect(migration).toContain('ALTER COLUMN "knowledgeSkill" DROP NOT NULL');
    expect(migration).toContain('ALTER COLUMN "awarenessSkill" DROP NOT NULL');
    expect(migration).not.toMatch(/UPDATE|DELETE|INSERT/i);
  });
});
