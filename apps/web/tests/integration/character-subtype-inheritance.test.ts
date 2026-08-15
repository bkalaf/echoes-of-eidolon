import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../..");
const schema = readFileSync(resolve(webRoot, "prisma/schema.prisma"), "utf8");
const types = readFileSync(resolve(webRoot, "src/domain/types.ts"), "utf8");
const entities = readFileSync(resolve(webRoot, "src/content/entities.ts"), "utf8");
const campaigns = readFileSync(resolve(webRoot, "src/server/campaigns.ts"), "utf8");
const adminContract = JSON.parse(readFileSync(resolve(webRoot, "src/data/entity-admin-contract.json"), "utf8")) as { entities: Record<string, { fields: Array<{ name: string }>; idField: string }> };
const migration = readFileSync(resolve(webRoot, "prisma/migrations/20260814192000_character_subtype_shared_primary_keys/migration.sql"), "utf8");

const model = (name: string) => schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";

describe("Character subtype shared-primary-key persistence", () => {
  it("keeps exactly the three authorized subtype relationships on Character", () => {
    const character = model("Character");
    expect(character).toMatch(/architect\s+Architect\?/);
    expect(character).toMatch(/witness\s+Witness\?/);
    expect(character).toMatch(/companion\s+Companion\?/);
    expect([...schema.matchAll(/character\s+Character\s+@relation\(fields: \[characterId\], references: \[characterId\], onDelete: Cascade\)/g)]).toHaveLength(3);
  });

  it("does not reintroduce independent Witness or Architect identity outside migration history", () => {
    expect(types).not.toMatch(/\b(witnessId|architectId)\b/);
    expect(entities).not.toMatch(/\b(witnessId|architectId)\b/);
    expect(campaigns).not.toMatch(/\b(witnessId|architectId)\b/);
  });

  it("publishes Character-owned subtype identity in the generated Admin contract", () => {
    expect(adminContract.entities.Architect?.idField).toBe("characterId");
    expect(adminContract.entities.Architect?.fields.map((field) => field.name)).toEqual(["characterId", "department"]);
    expect(adminContract.entities.Witness?.idField).toBe("characterId");
    expect(adminContract.entities.Witness?.fields.map((field) => field.name)).toEqual(["characterId", "witnessDefId", "trueFlawName", "architectCharacterId", "legendaryRewardId", "constellationBeforeId", "constellationAfterId"]);
    expect(adminContract.entities.Companion?.idField).toBe("characterId");
  });

  it("migrates both subtype keys and the Architect relation forward-only and fail-closed", () => {
    expect(migration).toContain("CHARACTER_SUBTYPE_INHERITANCE_BLOCKER");
    expect(migration).toContain('RENAME COLUMN "architectId" TO "architectCharacterId"');
    expect(migration).toContain('DROP COLUMN "witnessId"');
    expect(migration).toContain('DROP COLUMN "architectId"');
    expect(migration).toContain('PRIMARY KEY ("characterId")');
    expect(migration).toContain('REFERENCES "Architect"("characterId") ON DELETE RESTRICT');
    expect(migration).toContain('DROP COLUMN "profession"');
  });
});
