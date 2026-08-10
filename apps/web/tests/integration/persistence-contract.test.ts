import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("persistence contract", () => {
  it("keeps the Prisma schema valid without requiring a live database", () => {
    const output = execFileSync("pnpm", ["exec", "prisma", "validate"], {
      cwd: resolve(import.meta.dirname, "../.."),
      encoding: "utf8",
    });
    expect(output).toContain("is valid");
  });

  it("persists closed-world cardinality and conservation guards", () => {
    const migration = readFileSync(
      resolve(
        import.meta.dirname,
        "../../prisma/migrations/20260810043000_initial/migration.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("Witness_distinct_antagonists_check");
    expect(migration).toContain("Companion_distinct_protagonists_check");
    expect(migration).toContain("BreedPopulation_nonnegative_check");
    expect(migration).toContain("PuzzleBlueprint_authored_hints_check");
  });

  it("renames age eligibility without storing date of birth or exact age", () => {
    const migration = readFileSync(
      resolve(
        import.meta.dirname,
        "../../prisma/migrations/20260810070000_identity_beta_and_two_factor/migration.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("ADULT_18_PLUS");
    expect(migration).toContain("MINOR_14_17_GUARDIAN_CONSENTED");
    expect(migration).not.toContain('"dateOfBirth"');
    expect(migration).not.toContain('"exactAge"');
  });

  it("persists beta invitations separately from roles and entitlements", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../prisma/migrations/20260810070000_identity_beta_and_two_factor/migration.sql"),
      "utf8",
    );
    expect(migration).toContain('CREATE TABLE "BetaInviteRequest"');
    expect(migration).toContain('CREATE TABLE "BetaInvitationCode"');
    expect(migration).toContain('"codeHash" TEXT NOT NULL');
    expect(migration).toContain('"betaEligible" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).not.toContain('"code" TEXT');
  });

  it("persists the Better Auth Organizations authorization schema", () => {
    const migration = readFileSync(
      resolve(
        import.meta.dirname,
        "../../prisma/migrations/20260810060000_better_auth_organizations/migration.sql",
      ),
      "utf8",
    );
    expect(migration).toContain('CREATE TABLE "Organization"');
    expect(migration).toContain('CREATE TABLE "Member"');
    expect(migration).toContain('CREATE TABLE "Invitation"');
    expect(migration).toContain('"activeOrganizationId"');
    expect(migration).toContain('Member_organizationId_userId_key');
  });

  it("persists finite account authorization separately from organizations", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../prisma/migrations/20260810080000_better_auth_account_authorization/migration.sql"),
      "utf8",
    );
    expect(migration).toContain("CREATE TYPE \"AuthorizationRole\" AS ENUM ('user', 'member', 'admin', 'owner')");
    expect(migration).toContain('ADD COLUMN "role" "AuthorizationRole" NOT NULL DEFAULT \'user\'');
  });

  it("enforces the core domain relationship map with database foreign keys", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../prisma/migrations/20260810100000_core_domain_relationships/migration.sql"),
      "utf8",
    );
    expect(migration).toContain('CONSTRAINT "Breed_speciesId_fkey"');
    expect(migration).toContain('CONSTRAINT "Breed_cultureId_fkey"');
    expect(migration).toContain('CONSTRAINT "Character_breedId_fkey"');
    expect(migration).toContain('CONSTRAINT "Protagonist_characterId_fkey"');
    expect(migration).toContain('CONSTRAINT "Antagonist_characterId_fkey"');
    expect(migration).toContain('CONSTRAINT "Witness_antagonist1Id_fkey"');
    expect(migration).toContain('CONSTRAINT "Witness_antagonist2Id_fkey"');
    expect(migration).toContain('CONSTRAINT "Citation_sourceId_fkey"');
    expect(migration).toContain('CONSTRAINT "Research_citationId_fkey"');
  });

  it("fails closed when casting stored finite values and removes forbidden Research owner fields", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../prisma/migrations/20260810100000_core_domain_relationships/migration.sql"),
      "utf8",
    );
    expect(migration).toContain('USING ("culturePoolId"::text::"CulturePoolId")');
    expect(migration).toContain('USING ("companionKey"::text::"CompanionKey")');
    expect(migration).toContain('USING ("heirloom"::text::"Heirloom")');
    expect(migration).not.toMatch(/DROP COLUMN "(culturePoolId|companionKey|heirloom|sourceType)"/);
    expect(migration).toContain('DROP COLUMN "ownerEntityId"');
    expect(migration).toContain('DROP COLUMN "ownerEntityType"');
  });
});
