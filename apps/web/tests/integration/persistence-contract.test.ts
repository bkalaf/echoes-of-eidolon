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

  it("persists Better Auth account authorization separately from organizations without adding a Prisma enum", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../prisma/migrations/20260810080000_better_auth_account_authorization/migration.sql"),
      "utf8",
    );
    expect(migration).not.toContain('CREATE TYPE "AuthorizationRole"');
    expect(migration).toContain('ADD COLUMN "role" TEXT NOT NULL DEFAULT \'user\'');
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

  it("makes SettlementWorld and ordered population events the persistence authority", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../prisma/migrations/20260810110000_settlement_event_authority/migration.sql"),
      "utf8",
    );
    expect(migration).toContain('CREATE TABLE "SettlementWorld"');
    expect(migration).toContain('CREATE TABLE "SettlementPopulationEvent"');
    expect(migration).toContain('SettlementWorld_settlementId_worldKey_key');
    expect(migration).toContain('SettlementPopulationEvent_settlementWorldId_year_sequence_key');
    expect(migration).toContain('SettlementPopulationEvent_settlementWorldId_fkey');
    expect(migration).toContain('SettlementPopulationEvent_breedId_fkey');
    expect(migration).toContain('SettlementPopulationEvent_reject_update');
    expect(migration).toContain('SettlementPopulationEvent_reject_delete');
    expect(migration).toContain("BreedPopulation contains rows and requires an explicitly approved event migration");
    expect(migration).toContain("Site settlement link conflicts with Settlement.siteId authority");
  });

  it("deduplicates managed assets by final bytes and preserves immutable prompt versions", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../prisma/migrations/20260810120000_managed_assets_and_prompts/migration.sql"),
      "utf8",
    );
    expect(migration).toContain('CREATE TABLE "ManagedAsset"');
    expect(migration).toContain('CREATE TABLE "AssetPurposeLink"');
    expect(migration).toContain('ManagedAsset_sha256_key');
    expect(migration).toContain('ManagedAsset_object_key_check');
    expect(migration).toContain('AssetPurposeLink_purpose_key');
    expect(migration).toContain('CREATE TABLE "PromptRecord"');
    expect(migration).toContain('CREATE TABLE "PromptVersion"');
    expect(migration).toContain('PromptVersion_promptRecordId_version_key');
    expect(migration).toContain('PromptVersion_generatedManagedAssetId_fkey');
    expect(migration).toContain('PromptVersion_reject_update');
    expect(migration).toContain('PromptVersion_reject_delete');
    expect(migration).toContain('AchievementDefinition_imageAssetId_fkey');
    expect(migration).not.toContain('PromptVersion_version_check');
  });

  it("makes validated append-only CapabilityEvent rows the capability source of truth", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../prisma/migrations/20260810130000_capability_event_authority/migration.sql"),
      "utf8",
    );
    expect(migration).toContain('RENAME COLUMN "valueType" TO "valueKind"');
    expect(migration).toContain('CREATE TABLE "CapabilityEvent"');
    expect(migration).toContain('CapabilityEvent_exactly_one_value_check');
    expect(migration).toContain('CapabilityEvent_userId_sequence_key');
    expect(migration).toContain('CapabilityEvent_validate');
    expect(migration).toContain('CapabilityEvent_reject_update');
    expect(migration).toContain('CapabilityEvent_reject_delete');
    expect(migration).toContain('AchievementDefinition_chainKey_rank_key');
  });

  it("stores capability-gated knowledge disclosures without merging hidden citations into base citations", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../prisma/migrations/20260810140000_knowledge_disclosures/migration.sql"),
      "utf8",
    );
    expect(migration).toContain('CREATE TABLE "KnowledgeBaseBlock"');
    expect(migration).toContain('CREATE TABLE "KnowledgeBaseDisclosure"');
    expect(migration).toContain('CREATE TABLE "KnowledgeBaseDisclosureBlock"');
    expect(migration).toContain('CREATE TABLE "KnowledgeBaseDisclosureCitation"');
    expect(migration).toContain('KnowledgeBaseDisclosure_requirement_value_check');
    expect(migration).toContain('KnowledgeBaseDisclosure_anchor_check');
    expect(migration).toContain('KnowledgeBaseDisclosure_validate');
    expect(migration).toContain('KnowledgeBaseDisclosureCitation_citationId_fkey');
  });

  it("separates stable PuzzleBlueprint roots from immutable versions, hints, and acceptance timing", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../prisma/migrations/20260810150000_puzzle_versions_and_acceptance/migration.sql"),
      "utf8",
    );
    expect(migration).toContain('CREATE TABLE "PuzzleBlueprintVersion"');
    expect(migration).toContain('PRIMARY KEY ("puzzleBlueprintId", "generatorVersion")');
    expect(migration).toContain('CREATE TABLE "PuzzleHintTemplate"');
    expect(migration).toContain('PuzzleHintTemplate_shape_check');
    expect(migration).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(migration).toContain('PuzzleBlueprintVersion_reject_update');
    expect(migration).toContain('PuzzleHintTemplate_reject_update');
    expect(migration).toContain('CREATE TABLE "PuzzleChallengeAccepted"');
    expect(migration).toContain('PuzzleChallengeAccepted_reject_update');
    expect(migration).not.toContain('"endsAt"');
  });

  it("keeps membership grants and donation refund revocations in a separate append-only ledger", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../prisma/migrations/20260810160000_membership_ledger/migration.sql"),
      "utf8",
    );
    expect(migration).toContain('CREATE TABLE "MembershipGrant"');
    expect(migration).toContain('CREATE TABLE "MembershipRevocation"');
    expect(migration).toContain('CREATE TABLE "Perk"');
    expect(migration).toContain('"amountCents" = 999');
    expect(migration).toContain('MembershipRevocation_validate');
    expect(migration).toContain('attempts to revoke consumed entitlement time');
    expect(migration).toContain('MembershipGrant_reject_update');
    expect(migration).toContain('MembershipRevocation_reject_update');
    expect(migration).not.toMatch(/ALTER TABLE "User".*"role"/s);
    expect(migration).not.toMatch(/ALTER TABLE "User".*"betaEligible"/s);
  });

  it("makes Stripe confirmation structural authority for Printful fulfillment", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../prisma/migrations/20260810170000_commerce_payment_fulfillment/migration.sql"),
      "utf8",
    );
    expect(migration).toContain('CREATE TABLE "StripeWebhookEvent"');
    expect(migration).toContain('StripeWebhookEvent_payload_hash_check');
    expect(migration).toContain('CREATE TABLE "OrderPaymentConfirmation"');
    expect(migration).toContain('CREATE TABLE "PrintfulFulfillmentSubmission"');
    expect(migration).toContain('PrintfulFulfillment_confirmation_fkey');
    expect(migration).toContain('OrderLine_validate_price');
    expect(migration).toContain('OrderRefund_validate');
    expect(migration).toContain('CREATE TABLE "OrderReturnEligibility"');
    expect(migration).toContain('StripeWebhookEvent_reject_update');
  });
});
