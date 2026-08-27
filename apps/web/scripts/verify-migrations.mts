import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import process from "node:process";

import { Client } from "pg";

function run(command: string, args: string[], environment: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: environment, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} terminated by ${signal}`));
      else if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function expectDatabaseRejection(work: () => Promise<unknown>, message: string): Promise<void> {
  try {
    await work();
  } catch {
    return;
  }
  throw new Error(message);
}

async function expectTransactionRejection(client: Client, work: () => Promise<void>, message: string): Promise<void> {
  await client.query("BEGIN");
  let rejected = false;
  try {
    await work();
    await client.query("COMMIT");
  } catch {
    rejected = true;
  } finally {
    await client.query("ROLLBACK");
  }
  if (!rejected) throw new Error(message);
}

const configuredUrl = new URL(process.env.DATABASE_URL ?? "");
if (!["127.0.0.1", "localhost"].includes(configuredUrl.hostname)) {
  throw new Error("Migration verification only runs against local PostgreSQL.");
}

const databaseName = `eidolon_migration_verify_${randomUUID().replaceAll("-", "")}`;
const preCorrectionDatabaseName = `eidolon_migration_precorrection_${randomUUID().replaceAll("-", "")}`;
const documentGuardDatabaseName = `eidolon_document_guard_${randomUUID().replaceAll("-", "")}`;
const adminUrl = new URL(configuredUrl);
adminUrl.pathname = "/postgres";
const verificationUrl = new URL(configuredUrl);
verificationUrl.pathname = `/${databaseName}`;
const preCorrectionUrl = new URL(configuredUrl);
preCorrectionUrl.pathname = `/${preCorrectionDatabaseName}`;
const documentGuardUrl = new URL(configuredUrl);
documentGuardUrl.pathname = `/${documentGuardDatabaseName}`;
const admin = new Client({ connectionString: adminUrl.toString() });

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const environment = { ...process.env, DATABASE_URL: verificationUrl.toString() };
  await run("pnpm", ["exec", "prisma", "migrate", "deploy"], environment);
  const ownerVerificationDirectory = await mkdtemp(resolve(tmpdir(), "eidolon-owner-verify-"));
  try {
    const ownerVerificationSecrets: Record<string, string> = {
      database_url: verificationUrl.toString(),
      better_auth_secret: environment.BETTER_AUTH_SECRET ?? "migration-verification-auth-secret",
      better_auth_url: environment.BETTER_AUTH_URL ?? "http://127.0.0.1:3000",
      resend_api_key: environment.RESEND_API_KEY ?? "migration-verification-resend-key",
      resend_sender_address: environment.RESEND_FROM_EMAIL ?? "verification@example.test",
      owner_bootstrap_secret: "migration-verification-owner-secret",
    };
    await Promise.all(Object.entries(ownerVerificationSecrets).map(([name, value]) =>
      writeFile(resolve(ownerVerificationDirectory, name), `${value}\n`, { mode: 0o600 })));
    const ownerVerificationConfig = resolve(ownerVerificationDirectory, "config.json");
    await writeFile(ownerVerificationConfig, JSON.stringify({ credentialDirectory: ownerVerificationDirectory }), { mode: 0o600 });
    await run("node", ["scripts/run-owner-bootstrap.mjs", "--config", ownerVerificationConfig,
      "--email", "owner-bootstrap-verification@example.test", "--username", "owner_verification"], environment);
  } finally {
    await rm(ownerVerificationDirectory, { force: true, recursive: true });
  }
  await run("pnpm", [
    "exec", "prisma", "migrate", "diff",
    "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code",
  ], environment);

  const verification = new Client({ connectionString: verificationUrl.toString() });
  await verification.connect();
  try {
    const freshPuzzleVersions = await verification.query(
      `SELECT count(*)::int AS count FROM "PuzzleBlueprintVersion"
       WHERE "puzzleBlueprintId" IN ('PZB-011', 'PZB-012', 'PZB-021', 'PZB-037') AND "generatorVersion" = '1.1.0'`,
    );
    if (freshPuzzleVersions.rows[0]?.count !== 0) {
      throw new Error(`Fresh migration unexpectedly manufactured Puzzle roots: ${JSON.stringify(freshPuzzleVersions.rows)}`);
    }
    const ownerAccount = await verification.query(
      `SELECT u."email", u."username", u."role", u."emailVerified", a."providerId", a."password"
       FROM "User" u JOIN "Account" a ON a."userId" = u."id"
       WHERE u."email" = 'owner-bootstrap-verification@example.test'`,
    );
    if (ownerAccount.rows.length !== 1 || ownerAccount.rows[0]?.username !== "owner_verification"
      || ownerAccount.rows[0]?.role !== "owner" || ownerAccount.rows[0]?.emailVerified !== true
      || ownerAccount.rows[0]?.providerId !== "credential" || !ownerAccount.rows[0]?.password) {
      throw new Error("Owner bootstrap did not create the exact verified credential account.");
    }
    const hash = "a".repeat(64);
    await verification.query(
      `INSERT INTO "ManagedAsset" ("managedAssetId", "sha256", "objectKey", "mediaKind", "mimeType", "byteSize", "technicalMetadata")
       VALUES ($1, $1, $2, 'IMAGE', 'image/png', 1, '{"kind":"image"}'::jsonb)`,
      [hash, `assets/${hash}.png`],
    );
    await verification.query(
      `INSERT INTO "AssetPurposeLink" ("assetPurposeLinkId", "managedAssetId", "purpose") VALUES ('purpose', $1, 'purpose')`,
      [hash],
    );
    await verification.query(
      `INSERT INTO "PromptRecord" ("promptRecordId", "family", "purpose", "status", "targetType", "targetId")
       VALUES ('prompt', 'IMAGE', 'purpose', 'OUTSTANDING', 'target', 'target')`,
    );
    await verification.query(
      `INSERT INTO "PromptVersion" ("promptVersionId", "promptRecordId", "version", "promptText", "responseContract")
       VALUES ('version', 'prompt', 0, 'text', '{}'::jsonb)`,
    );
    await expectDatabaseRejection(
      () => verification.query(`UPDATE "PromptVersion" SET "promptText" = 'changed' WHERE "promptVersionId" = 'version'`),
      "PromptVersion update was not rejected",
    );
    await expectDatabaseRejection(
      () => verification.query(`DELETE FROM "PromptVersion" WHERE "promptVersionId" = 'version'`),
      "PromptVersion delete was not rejected",
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "ManagedAsset" ("managedAssetId", "sha256", "objectKey", "mediaKind", "mimeType", "byteSize", "technicalMetadata")
         VALUES ('invalid', $1, 'assets/not-the-hash.png', 'IMAGE', 'image/png', 1, '{"kind":"image"}'::jsonb)`,
        ["b".repeat(64)],
      ),
      "ManagedAsset object-key mismatch was not rejected",
    );

    await verification.query(
      `INSERT INTO "User" ("id", "name", "email", "eligibilityStatus", "updatedAt")
       VALUES ('capability-user', 'Capability User', 'capability@example.test', 'ADULT_18_PLUS', CURRENT_TIMESTAMP)`,
    );
    await verification.query(
      `INSERT INTO "CapabilityDefinition" ("capabilityDefinitionId", "code")
       VALUES ('capability-definition', 'VERIFIED_BOOLEAN')`,
    );
    await verification.query(
      `INSERT INTO "CapabilityDefinitionVersion" (
         "capabilityDefinitionVersionId", "capabilityDefinitionId", "version", "pathPattern", "valueKind",
         "allowedOperations", "monotonicPolicy", "description", "status"
       ) VALUES (
         'capability-definition:v1', 'capability-definition', 1, 'verified.boolean', 'BOOLEAN',
         ARRAY['SET', 'CLEAR']::"CapabilityOperation"[], 'TRUE_ONLY', 'verification definition', 'ACTIVE'
       )`,
    );
    await verification.query(
      `INSERT INTO "CapabilityAddress" ("capabilityAddressId", "capabilityDefinitionId", "bindings", "bindingsHash")
       VALUES ('capability-address', 'capability-definition', '{}'::jsonb, 'empty-bindings')`,
    );
    await verification.query(
      `INSERT INTO "CapabilityEvent" (
         "capabilityEventId", "scopeType", "scopeId", "capabilityAddressId",
         "capabilityDefinitionVersionId", "operation", "booleanValue", "idempotencyKey", "occurredAt"
       ) VALUES (
         'capability-event', 'ACCOUNT', 'capability-user', 'capability-address',
         'capability-definition:v1', 'SET', true, 'verified-set', CURRENT_TIMESTAMP
       )`,
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "CapabilityEvent" (
           "capabilityEventId", "scopeType", "scopeId", "capabilityAddressId",
           "capabilityDefinitionVersionId", "operation", "booleanValue", "occurredAt"
         ) VALUES (
           'bad-capability-event', 'ACCOUNT', 'capability-user', 'capability-address',
           'capability-definition:v1', 'ADD', true, CURRENT_TIMESTAMP
         )`,
      ),
      "Invalid BOOLEAN capability operation was not rejected",
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "CapabilityEvent" (
           "capabilityEventId", "scopeType", "scopeId", "capabilityAddressId",
           "capabilityDefinitionVersionId", "operation", "booleanValue", "idempotencyKey", "occurredAt"
         ) VALUES (
           'duplicate-capability-event', 'ACCOUNT', 'capability-user', 'capability-address',
           'capability-definition:v1', 'SET', true, 'verified-set', CURRENT_TIMESTAMP
         )`,
      ),
      "CapabilityEvent idempotency duplicate was not rejected",
    );
    const projectedCapability = await verification.query(
      `SELECT "isPresent", "booleanValue", "lastSequence" FROM "CapabilityState"
       WHERE "scopeType" = 'ACCOUNT' AND "scopeId" = 'capability-user' AND "capabilityAddressId" = 'capability-address'`,
    );
    if (projectedCapability.rows.length !== 1 || projectedCapability.rows[0]?.isPresent !== true
      || projectedCapability.rows[0]?.booleanValue !== true || projectedCapability.rows[0]?.lastSequence == null) {
      throw new Error(`Capability projection was not transactionally materialized: ${JSON.stringify(projectedCapability.rows)}`);
    }
    await expectDatabaseRejection(
      () => verification.query(`UPDATE "CapabilityEvent" SET "booleanValue" = false WHERE "capabilityEventId" = 'capability-event'`),
      "CapabilityEvent update was not rejected",
    );
    await expectDatabaseRejection(
      () => verification.query(`DELETE FROM "CapabilityEvent" WHERE "capabilityEventId" = 'capability-event'`),
      "CapabilityEvent delete was not rejected",
    );
    await expectDatabaseRejection(
      () => verification.query(
        `UPDATE "CapabilityDefinitionVersion" SET "pathPattern" = 'changed'
         WHERE "capabilityDefinitionVersionId" = 'capability-definition:v1'`,
      ),
      "Published CapabilityDefinitionVersion mutation was not rejected",
    );

    await verification.query(
      `INSERT INTO "Species" (
         "speciesId", "name", "speciesKind", "originMode", "reproductiveMethod", "longevityClass",
         "mortalityMode", "soulDisposition", "continuityGroup", "continuityPropagationMode"
       ) VALUES ('species-research', 'Research Species', 'HUMAN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN')`,
    );
    await verification.query(
      `INSERT INTO "Breed" ("breedId", "name", "speciesId", "populationKind", "groupId", "personalityId")
       VALUES ('breed-research', 'Research Breed', 'species-research', 'HUMAN', 'H01', 'ACCOUNTABILITY_CURSE_EXCUSE_CONFLICT')`,
    );
    await verification.query(
      `INSERT INTO "Breed" ("breedId", "name", "speciesId", "parentBreedId", "populationKind", "groupId", "personalityId")
       VALUES ('breed-research-child', 'Research Breed Child', 'species-research', 'breed-research', 'HUMAN', 'H01', 'ACCOUNTABILITY_CURSE_EXCUSE_CONFLICT')`,
    );
    await expectDatabaseRejection(
      () => verification.query(`UPDATE "Breed" SET "parentBreedId"='breed-research-child' WHERE "breedId"='breed-research'`),
      "Breed hierarchy cycle was not rejected",
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "Breed" ("breedId", "name", "speciesId", "parentBreedId", "populationKind", "groupId", "personalityId")
         VALUES ('breed-wrong-population', 'Wrong Population Child', 'species-research', 'breed-research', 'BEAST', 'B01', 'ACCOUNTABILITY_CURSE_EXCUSE_CONFLICT')`,
      ),
      "Breed parent population mismatch was not rejected",
    );
    await verification.query(
      `INSERT INTO "Source" ("sourceId", "title", "authors", "sourceType")
       VALUES ('source-research', 'Legitimate source', ARRAY['Author'], 'BOOK')`,
    );
    await verification.query(
      `INSERT INTO "Citation" ("citationId", "sourceId", "rendering")
       VALUES ('citation-research', 'source-research', 'Author, Legitimate source')`,
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "Research" ("researchId", "notes", "citationId")
         VALUES ('orphan-research', 'No typed owner', 'citation-research')`,
      ),
      "Orphan Research was not rejected",
    );
    await verification.query("BEGIN");
    await verification.query(
      `INSERT INTO "Research" ("researchId", "notes", "citationId")
       VALUES ('typed-research', 'Typed evidence', 'citation-research')`,
    );
    await verification.query(
      `INSERT INTO "BreedResearchValue" ("breedResearchValueId", "breedId", "dimension", "value")
       VALUES ('breed-research-value', 'breed-research', 'LOQUACITY', 'TALKATIVE')`,
    );
    await verification.query(
      `INSERT INTO "BreedResearchEvidence" ("breedResearchEvidenceId", "breedResearchValueId", "researchId")
       VALUES ('breed-research-evidence', 'breed-research-value', 'typed-research')`,
    );
    await verification.query("COMMIT");
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "BreedResearchValue" ("breedResearchValueId", "breedId", "dimension", "value")
         VALUES ('bad-breed-research-value', 'breed-research', 'LOQUACITY', 'JOYFUL')`,
      ),
      "Cross-dimension Breed research value was not rejected",
    );

    await verification.query(
      `INSERT INTO "KnowledgeBaseItem" ("knowledgeBaseItemId", "entityType", "entityId", "title", "baseContent") VALUES
       ('knowledge-one', 'CULTURE', 'culture-one', 'One', 'Base'),
       ('knowledge-two', 'CULTURE', 'culture-two', 'Two', 'Base')`,
    );
    await verification.query(
      `INSERT INTO "KnowledgeBaseBlock" ("knowledgeBaseBlockId", "knowledgeBaseItemId", "ordinal", "kind", "content") VALUES
       ('block-one', 'knowledge-one', 0, 'PARAGRAPH', 'One'),
       ('block-two', 'knowledge-two', 0, 'PARAGRAPH', 'Two')`,
    );
    await verification.query(
      `INSERT INTO "KnowledgeBaseDisclosure" (
         "knowledgeBaseDisclosureId", "knowledgeBaseItemId", "ordinal", "condition", "mode", "anchorBlockId"
       ) VALUES (
         'disclosure', 'knowledge-one', 0,
         '{"operator":"EQ","scope":{"scopeType":"ACCOUNT","scopeId":"capability-user"},"address":{"capabilityDefinitionId":"capability-definition","bindings":{}},"value":true}'::jsonb,
         'REPLACE_BLOCK', 'block-one'
       )`,
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "KnowledgeBaseDisclosure" (
           "knowledgeBaseDisclosureId", "knowledgeBaseItemId", "ordinal", "condition", "mode", "anchorBlockId"
         ) VALUES (
           'bad-disclosure', 'knowledge-one', 1, '{"operator":"EXISTS"}'::jsonb,
           'REPLACE_BLOCK', 'block-two'
         )`,
      ),
      "Cross-entry knowledge disclosure anchor was not rejected",
    );

    await verification.query(
      `INSERT INTO "PuzzleBlueprint" ("puzzleBlueprintId", "title", "primaryFamily", "difficultyTier")
       VALUES ('puzzle', 'Puzzle', 'LOGIC_CONSTRAINT', 'TIER_1_INITIATE')`,
    );
    await verification.query("BEGIN");
    await verification.query(
      `INSERT INTO "PuzzleBlueprintVersion" ("puzzleBlueprintId", "generatorVersion", "design") VALUES ('puzzle', '0.0.0', '{"schemaVersion":"manual-authoring-v1"}'::jsonb)`,
    );
    await verification.query(
      `INSERT INTO "PuzzleHintTemplate" ("puzzleBlueprintId", "generatorVersion", "level", "kind", "template") VALUES
       ('puzzle', '0.0.0', 1, 'DIRECTIONAL', 'Direction'),
       ('puzzle', '0.0.0', 2, 'GUIDED', 'Guide')`,
    );
    await verification.query("COMMIT");
    await expectTransactionRejection(
      verification,
      async () => {
        await verification.query(
          `INSERT INTO "PuzzleBlueprintVersion" ("puzzleBlueprintId", "generatorVersion", "design") VALUES ('puzzle', '1.0.0', '{"schemaVersion":"manual-authoring-v1"}'::jsonb)`,
        );
        await verification.query(
          `INSERT INTO "PuzzleHintTemplate" ("puzzleBlueprintId", "generatorVersion", "level", "kind", "template")
           VALUES ('puzzle', '1.0.0', 1, 'DIRECTIONAL', 'Only one')`,
        );
      },
      "PuzzleBlueprintVersion with one hint was not rejected",
    );
    await expectDatabaseRejection(
      () => verification.query(`UPDATE "PuzzleHintTemplate" SET "template" = 'Changed' WHERE "puzzleBlueprintId" = 'puzzle' AND "generatorVersion" = '0.0.0' AND "level" = 1`),
      "PuzzleHintTemplate update was not rejected",
    );
    await verification.query(
      `INSERT INTO "PuzzleChallengeAccepted" ("puzzleChallengeAcceptedId", "userId", "puzzleBlueprintId", "generatorVersion")
       VALUES ('acceptance', 'capability-user', 'puzzle', '0.0.0')`,
    );
    await expectDatabaseRejection(
      () => verification.query(`UPDATE "PuzzleChallengeAccepted" SET "acceptedAt" = CURRENT_TIMESTAMP WHERE "puzzleChallengeAcceptedId" = 'acceptance'`),
      "PuzzleChallengeAccepted update was not rejected",
    );

    await verification.query(
      `INSERT INTO "MembershipGrant" (
         "membershipGrantId", "userId", "source", "sourceReference", "amountCents", "monthsGranted", "anchorDay",
         "effectiveStartAt", "effectiveEndAt"
       ) VALUES (
         'subscription-grant', 'capability-user', 'SUBSCRIPTION', 'subscription-reference', 999, 1, 1,
         '2030-01-01T00:00:00Z', '2030-02-01T00:00:00Z'
       )`,
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "MembershipGrant" (
           "membershipGrantId", "userId", "source", "sourceReference", "amountCents", "monthsGranted", "anchorDay",
           "effectiveStartAt", "effectiveEndAt"
         ) VALUES (
           'bad-subscription-grant', 'capability-user', 'SUBSCRIPTION', 'bad-subscription-reference', 1000, 1, 1,
           '2030-01-01T00:00:00Z', '2030-02-01T00:00:00Z'
         )`,
      ),
      "Non-$9.99 subscription grant was not rejected",
    );
    await verification.query(
      `INSERT INTO "MembershipGrant" (
         "membershipGrantId", "userId", "source", "sourceReference", "amountCents", "monthsGranted", "anchorDay",
         "effectiveStartAt", "effectiveEndAt"
       ) VALUES (
         'donation-grant', 'capability-user', 'DONATION', 'donation-reference', 5000, 6, 1,
         '2030-01-01T00:00:00Z', '2030-07-01T00:00:00Z'
       )`,
    );
    await verification.query(
      `INSERT INTO "MembershipRevocation" (
         "membershipRevocationId", "membershipGrantId", "reason", "refundReference", "refundedAmountCents",
         "remainingNetAmountCents", "monthsAfterRefund", "effectiveEndBefore", "effectiveEndAfter"
       ) VALUES (
         'donation-revocation', 'donation-grant', 'DONATION_REFUND', 'refund-reference', 2500,
         2500, 2, '2030-07-01T00:00:00Z', '2030-03-01T00:00:00Z'
       )`,
    );
    await expectDatabaseRejection(
      () => verification.query(`UPDATE "MembershipGrant" SET "amountCents" = 1000 WHERE "membershipGrantId" = 'subscription-grant'`),
      "MembershipGrant update was not rejected",
    );

    await verification.query(
      `INSERT INTO "StoreProduct" ("storeProductId", "productType", "name", "active") VALUES ('store-product', 'POSTER', 'Configured product', true)`,
    );
    await verification.query(
      `INSERT INTO "StoreVariant" (
         "storeVariantId", "storeProductId", "priceCents", "stripePriceReference", "printfulVariantReference", "available"
       ) VALUES ('store-variant', 'store-product', 1000, 'stripe-price', 'printful-variant', true)`,
    );
    await verification.query(
      `INSERT INTO "Order" ("orderId", "userId", "contactEmail", "stripeCheckoutReference")
       VALUES ('store-order', 'capability-user', 'player@example.test', 'stripe-checkout')`,
    );
    await verification.query(
      `INSERT INTO "OrderLine" ("orderLineId", "orderId", "storeVariantId", "quantity", "unitPriceCents")
       VALUES ('order-line', 'store-order', 'store-variant', 2, 1000)`,
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "OrderLine" ("orderLineId", "orderId", "storeVariantId", "quantity", "unitPriceCents")
         VALUES ('bad-order-line', 'store-order', 'store-variant', 1, 1)`,
      ),
      "Browser-authored OrderLine price was not rejected",
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "PrintfulFulfillmentSubmission" (
           "printfulFulfillmentSubmissionId", "orderPaymentConfirmationId", "providerOrderReference"
         ) VALUES ('early-fulfillment', 'missing-confirmation', 'early-provider-order')`,
      ),
      "Printful fulfillment without payment confirmation was not rejected",
    );
    await verification.query(
      `INSERT INTO "StripeWebhookEvent" ("stripeWebhookEventId", "eventType", "payloadSha256", "processedAt")
       VALUES ('stripe-event', 'confirmed', $1, CURRENT_TIMESTAMP)`,
      ["c".repeat(64)],
    );
    await verification.query(
      `INSERT INTO "OrderPaymentConfirmation" (
         "orderPaymentConfirmationId", "orderId", "stripeWebhookEventId", "amountCents", "confirmedAt"
       ) VALUES ('payment-confirmation', 'store-order', 'stripe-event', 2000, CURRENT_TIMESTAMP)`,
    );
    await verification.query(
      `INSERT INTO "PrintfulFulfillmentSubmission" (
         "printfulFulfillmentSubmissionId", "orderPaymentConfirmationId", "providerOrderReference"
       ) VALUES ('fulfillment', 'payment-confirmation', 'printful-order')`,
    );
    await verification.query(
      `INSERT INTO "OrderReturnEligibility" ("orderReturnEligibilityId", "orderId", "eligibleAt")
       VALUES ('return-eligibility', 'store-order', CURRENT_TIMESTAMP)`,
    );
    await expectDatabaseRejection(
      () => verification.query(`UPDATE "StripeWebhookEvent" SET "eventType" = 'changed' WHERE "stripeWebhookEventId" = 'stripe-event'`),
      "StripeWebhookEvent update was not rejected",
    );

    const groupingDefinitions = await verification.query(
      `SELECT "groupingType", "editability" FROM "BookGroupingDefinition" ORDER BY "groupingType"`,
    );
    const groupingValues = await verification.query(
      `SELECT "worldKey", "logicalKey", "bookNumbers" FROM "BookGroupingValue" ORDER BY "worldKey", "ordinal"`,
    );
    if (groupingDefinitions.rows.length !== 8 || groupingValues.rows.length !== 9) {
      throw new Error(`Book grouping seed cardinality is invalid: ${JSON.stringify({ definitions: groupingDefinitions.rows, values: groupingValues.rows })}`);
    }
    if (groupingValues.rows.some((row) => row.bookNumbers.length !== 6)) {
      throw new Error(`Disjoint Trilogy seed membership is invalid: ${JSON.stringify(groupingValues.rows)}`);
    }
    const persistedOpposing = await verification.query(
      `SELECT count(*)::int AS count FROM "BookGroupingValue" value
       JOIN "BookGroupingDefinition" definition USING ("bookGroupingDefinitionId")
       WHERE definition."groupingType" = 'OPPOSING_FACTION'`,
    );
    if (persistedOpposing.rows[0]?.count !== 0) throw new Error("Opposing Faction must remain derived rather than persisted as an editable value");
    await expectTransactionRejection(
      verification,
      async () => {
        await verification.query(
          `UPDATE "BookGroupingValue" SET "bookNumbers" = ARRAY[1,2,3,4,5,6]
           WHERE "bookGroupingValueId" = 'BOOK-GROUPING-DISJOINT-CONCORD-A'`,
        );
      },
      "A partial Disjoint Trilogy update was not rejected at commit",
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "BookGroupingValue" (
           "bookGroupingValueId", "bookGroupingDefinitionId", "worldKey", "logicalKey", "bookNumbers", "ordinal"
         ) VALUES ('forbidden-opposing', 'BOOK-GROUPING-OPPOSING-FACTION', 'CONCORD', 'RUIN', ARRAY[1,2,3,4,5,6,13,14,15,16,17,18], 0)`,
      ),
      "A locked derived Book grouping value was persisted",
    );
    await verification.query("BEGIN");
    await verification.query(
      `UPDATE "BookGroupingValue" SET "bookNumbers" = ARRAY[4,5,6,13,14,15]
       WHERE "bookGroupingValueId" = 'BOOK-GROUPING-DISJOINT-CONCORD-A'`,
    );
    await verification.query(
      `UPDATE "BookGroupingValue" SET "bookNumbers" = ARRAY[1,2,3,10,11,12]
       WHERE "bookGroupingValueId" = 'BOOK-GROUPING-DISJOINT-CONCORD-B'`,
    );
    await verification.query("COMMIT");
    const regrouped = await verification.query(
      `SELECT "logicalKey", "bookNumbers" FROM "BookGroupingValue"
       WHERE "worldKey" = 'CONCORD' ORDER BY "ordinal"`,
    );
    if (JSON.stringify(regrouped.rows[0]) !== JSON.stringify({ logicalKey: "A", bookNumbers: [4, 5, 6, 13, 14, 15] })) {
      throw new Error(`Atomic Disjoint Trilogy regroup did not persist exactly: ${JSON.stringify(regrouped.rows)}`);
    }

    const mappingCounts = await verification.query(
      `SELECT count(*)::int AS total, count(DISTINCT "regionId")::int AS regions,
              count(DISTINCT "latticeId")::int AS lattices
       FROM "RegionLatticeMapping"`,
    );
    if (JSON.stringify(mappingCounts.rows[0]) !== JSON.stringify({ total: 25, regions: 25, lattices: 25 })) {
      throw new Error(`Atlas Region Mapping cardinality is invalid: ${JSON.stringify(mappingCounts.rows)}`);
    }
    const keyMappings = await verification.query(
      `SELECT "regionId", "latticeId" FROM "RegionLatticeMapping" WHERE "regionId" IN ('R01', 'R06') ORDER BY "regionId"`,
    );
    if (JSON.stringify(keyMappings.rows) !== JSON.stringify([{ regionId: "R01", latticeId: "L03" }, { regionId: "R06", latticeId: "L14" }])) {
      throw new Error(`Atlas Region Mapping contains suffix inference or lost R06/L14: ${JSON.stringify(keyMappings.rows)}`);
    }
    const connectionCounts = await verification.query(
      `SELECT "connectionType", "wrapMode", count(*)::int AS count
       FROM "AtlasConnection" GROUP BY "connectionType", "wrapMode" ORDER BY "connectionType"`,
    );
    if (JSON.stringify(connectionCounts.rows) !== JSON.stringify([
      { connectionType: "BASE", wrapMode: "NONE", count: 38 },
      { connectionType: "NORMAL", wrapMode: "NONE", count: 1 },
      { connectionType: "LEFT_RIGHT_CROSSOVER", wrapMode: "DATE_LINE", count: 5 },
    ])) {
      throw new Error(`Atlas connection configuration is invalid: ${JSON.stringify(connectionCounts.rows)}`);
    }
    const pollutedTables = await verification.query(
      `SELECT to_regclass('public."Matrix"') AS matrix, to_regclass('public."Lattice"') AS lattice`,
    );
    if (pollutedTables.rows[0]?.matrix !== null || pollutedTables.rows[0]?.lattice !== null) {
      throw new Error(`Polluted Matrix or forbidden Lattice table remains: ${JSON.stringify(pollutedTables.rows)}`);
    }
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "AtlasConnection" (
           "atlasConnectionId", "fromLatticeId", "toLatticeId", "connectionType", "wrapMode", "locked"
         ) VALUES ('bad-wrap', 'L02', 'L05', 'BASE', 'DATE_LINE', true)`,
      ),
      "Atlas connection accepted an invalid type/wrap combination",
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "AtlasConnection" (
           "atlasConnectionId", "fromLatticeId", "toLatticeId", "connectionType", "wrapMode", "locked"
         ) VALUES ('bad-order', 'L05', 'L02', 'BASE', 'NONE', true)`,
      ),
      "Atlas connection accepted a reversed undirected pair",
    );
    await verification.query(
      `INSERT INTO "User" ("id", "name", "email", "eligibilityStatus", "updatedAt")
       VALUES ('bulk-owner', 'Bulk Owner', 'bulk-owner@example.test', 'ADULT_18_PLUS', now())`,
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "ExternalBulkApiSession" (
           "externalBulkApiSessionId", "issuedByUserId", "keyHash", "expiresAt", "lastActivityAt"
         ) VALUES ('bad-key', 'bulk-owner', 'plaintext', now() + interval '30 minutes', now())`,
      ),
      "External bulk API session accepted a non-hash secret",
    );
    await verification.query(
      `INSERT INTO "ExternalBulkApiSession" (
         "externalBulkApiSessionId", "issuedByUserId", "keyHash", "state", "expiresAt", "lastActivityAt"
       ) VALUES ('bulk-session', 'bulk-owner', repeat('a', 64), 'KEYED', now() + interval '30 minutes', now())`,
    );
    await verification.query(
      `INSERT INTO "ExternalBulkApiSession" (
         "externalBulkApiSessionId", "issuedByUserId", "keyHash", "state", "expiresAt", "lastActivityAt"
       ) VALUES ('bulk-keyless', 'bulk-owner', NULL, 'KEYLESS', now() + interval '30 minutes', now())`,
    );
    await verification.query(
      `INSERT INTO "ExternalBulkApiSession" (
         "externalBulkApiSessionId", "issuedByUserId", "keyHash", "state", "expiresAt", "lastActivityAt", "revokedAt"
       ) VALUES ('bulk-off', 'bulk-owner', NULL, 'OFF', now() + interval '30 minutes', now(), now())`,
    );
    await expectTransactionRejection(verification, async () => {
      await verification.query(
        `INSERT INTO "ExternalBulkApiSession" (
           "externalBulkApiSessionId", "issuedByUserId", "keyHash", "state", "expiresAt", "lastActivityAt"
         ) VALUES ('bad-keyless-hash', 'bulk-owner', repeat('b', 64), 'KEYLESS', now() + interval '30 minutes', now())`,
      );
    }, "KEYLESS external bulk session accepted a non-null key hash");
    await expectTransactionRejection(verification, async () => {
      await verification.query(
        `INSERT INTO "ExternalBulkApiSession" (
           "externalBulkApiSessionId", "issuedByUserId", "keyHash", "state", "expiresAt", "lastActivityAt"
         ) VALUES ('bad-keyed-null', 'bulk-owner', NULL, 'KEYED', now() + interval '30 minutes', now())`,
      );
    }, "KEYED external bulk session accepted a null key hash");
    await expectTransactionRejection(verification, async () => {
      await verification.query(
        `INSERT INTO "ExternalBulkApiSession" (
           "externalBulkApiSessionId", "issuedByUserId", "keyHash", "state", "expiresAt", "lastActivityAt", "revokedAt"
         ) VALUES ('bad-active-revoked', 'bulk-owner', NULL, 'KEYLESS', now() + interval '30 minutes', now(), now())`,
      );
    }, "Active external bulk session accepted a revokedAt value");
    await expectTransactionRejection(verification, async () => {
      await verification.query(
        `INSERT INTO "ExternalBulkApiSession" (
           "externalBulkApiSessionId", "issuedByUserId", "keyHash", "state", "expiresAt", "lastActivityAt"
         ) VALUES ('bad-off-active', 'bulk-owner', NULL, 'OFF', now() + interval '30 minutes', now())`,
      );
    }, "OFF external bulk session accepted a null revokedAt value");
    await verification.query(
      `INSERT INTO "BulkOperationAudit" (
         "bulkOperationAuditId", "externalBulkApiSessionId", "operation", "entityName", "result", "recordCount"
       ) VALUES ('bulk-audit', 'bulk-session', 'QUERY', 'Soul', 'UNCHANGED', 0)`,
    );
    await expectDatabaseRejection(
      () => verification.query(`UPDATE "BulkOperationAudit" SET "recordCount" = 1 WHERE "bulkOperationAuditId" = 'bulk-audit'`),
      "Bulk operation audit accepted an update",
    );
    await expectDatabaseRejection(
      () => verification.query(`DELETE FROM "BulkOperationAudit" WHERE "bulkOperationAuditId" = 'bulk-audit'`),
      "Bulk operation audit accepted a delete",
    );
    await verification.query(
      `UPDATE "ExternalBulkApiSession" SET "state" = 'OFF', "revokedAt" = now()
       WHERE "externalBulkApiSessionId" = 'bulk-session'`,
    );
    await verification.query(
      `UPDATE "ExternalBulkApiSession" SET "state" = 'OFF', "revokedAt" = now()
       WHERE "externalBulkApiSessionId" = 'bulk-keyless'`,
    );
  } finally {
    await verification.end();
  }

  // Exercise forward data correction from a real historical schema rather than
  // treating a clean install as proof that legacy rows survive the migrations.
  await admin.query(`CREATE DATABASE "${preCorrectionDatabaseName}"`);
  const preCorrection = new Client({ connectionString: preCorrectionUrl.toString() });
  await preCorrection.connect();
  try {
    const migrationsRoot = resolve(import.meta.dirname, "../prisma/migrations");
    const migrations = (await readdir(migrationsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const applyThrough = async (lastMigration: string): Promise<void> => {
      for (const migration of migrations.filter((name) => name <= lastMigration)) {
        if (appliedMigrations.has(migration)) continue;
        await preCorrection.query(await readFile(resolve(migrationsRoot, migration, "migration.sql"), "utf8"));
        appliedMigrations.add(migration);
      }
    };
    const appliedMigrations = new Set<string>();
    await applyThrough("20260810170000_commerce_payment_fulfillment");
    await preCorrection.query(
      `INSERT INTO "User" ("id", "name", "email", "eligibilityStatus", "updatedAt")
       VALUES ('legacy-user', 'Legacy User', 'legacy@example.test', 'ADULT_18_PLUS', CURRENT_TIMESTAMP)`,
    );
    await preCorrection.query(
      `INSERT INTO "CapabilityDefinition" ("capabilityDefinitionId", "key", "valueKind", "description", "minValue", "maxValue")
       VALUES ('legacy-counter-definition', 'legacy-counter', 'COUNTER', 'Legacy counter', 0, 100)`,
    );
    await preCorrection.query(
      `INSERT INTO "CapabilityEvent" (
         "capabilityEventId", "userId", "capabilityDefinitionId", "sequence", "operation", "valueNumber", "createdAt"
       ) VALUES ('legacy-counter-event', 'legacy-user', 'legacy-counter-definition', 4, 'SET', 7, '2026-08-01T00:00:00Z')`,
    );

    await applyThrough("20260810210000_store_product_type");
    const oldPairs = [[1, 18], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 17]];
    await preCorrection.query(`INSERT INTO "Campaign" ("campaignId", "worldKey", "name") VALUES ('legacy-campaign', 'CONCORD', 'Legacy campaign')`);
    for (const [ordinal, [bookA, bookB]] of oldPairs.entries()) {
      await preCorrection.query(
        `INSERT INTO "Transition" ("transitionId", "name", "bookA", "bookB", "summary") VALUES ($1, $2, $3, $4, 'Legacy pair')`,
        [`legacy-transition-${ordinal}`, `Legacy transition ${ordinal}`, bookA, bookB],
      );
      await preCorrection.query(
        `INSERT INTO "CampaignPlacement" (
           "campaignPlacementId", "campaignId", "objectType", "objectId", "bookNumbers", "ordinal"
         ) VALUES ($1, 'legacy-campaign', 'COMPANION', $2, $3, $4)`,
        [`legacy-placement-${ordinal}`, `legacy-companion-${ordinal}`, [bookA, bookB], ordinal],
      );
    }

    await applyThrough("20260810250000_puzzle_acceptance_index_name");
    const legacyCapability = await preCorrection.query(
      `SELECT "counterValue", "scoreValue", "occurredAt"::text AS "occurredAtText" FROM "CapabilityEvent" WHERE "capabilityEventId" = 'legacy-counter-event'`,
    );
    if (
      legacyCapability.rows[0]?.counterValue !== "7" ||
      legacyCapability.rows[0]?.scoreValue !== null ||
      legacyCapability.rows[0]?.occurredAtText !== "2026-08-01 00:00:00"
    ) {
      throw new Error(`Representative legacy CapabilityEvent was not preserved by the owner correction migration: ${JSON.stringify(legacyCapability.rows)}`);
    }
    const expectedPairs = [[1, 18], [2, 17], [3, 16], [4, 15], [5, 14], [6, 13], [7, 12], [8, 11], [9, 10]];
    const transitioned = await preCorrection.query(`SELECT "bookA", "bookB" FROM "Transition" ORDER BY "bookA"`);
    const placed = await preCorrection.query(`SELECT "bookNumbers" FROM "CampaignPlacement" ORDER BY "bookNumbers"[1]`);
    if (
      JSON.stringify(transitioned.rows.map((row) => [row.bookA, row.bookB])) !== JSON.stringify(expectedPairs) ||
      JSON.stringify(placed.rows.map((row) => row.bookNumbers)) !== JSON.stringify(expectedPairs)
    ) {
      throw new Error("Representative legacy duology rows were not translated to the canonical mirrored pairing");
    }

    await preCorrection.query(
      `INSERT INTO "KnowledgeBaseItem" ("knowledgeBaseItemId", "entityType", "entityId", "title", "baseContent")
       VALUES ('legacy-knowledge', 'CULTURE', 'legacy-culture', 'Legacy knowledge', 'Base')`,
    );
    await preCorrection.query(
      `INSERT INTO "KnowledgeBaseDisclosure" (
         "knowledgeBaseDisclosureId", "knowledgeBaseItemId", "capabilityDefinitionId", "ordinal", "operator", "mode"
       ) VALUES (
         'legacy-disclosure', 'legacy-knowledge', 'legacy-counter-definition', 0, 'EXISTS', 'APPEND_BLOCKS'
       )`,
    );

    await applyThrough("20260810255000_capability_enum_extensions");
    const capabilityMigration = await readFile(resolve(
      migrationsRoot,
      "20260810260000_capability_ledger_projection",
      "migration.sql",
    ), "utf8");
    let unsafeEventError = "";
    try {
      await preCorrection.query(capabilityMigration);
    } catch (error) {
      unsafeEventError = error instanceof Error ? error.message : String(error);
    }
    if (!unsafeEventError.includes("legacy-counter-event")) {
      throw new Error(`Capability migration did not fail closed with the legacy event identity: ${unsafeEventError}`);
    }

    await preCorrection.query(`TRUNCATE "CapabilityEvent"`);
    let unsafeDisclosureError = "";
    try {
      await preCorrection.query(capabilityMigration);
    } catch (error) {
      unsafeDisclosureError = error instanceof Error ? error.message : String(error);
    }
    if (!unsafeDisclosureError.includes("legacy-disclosure")) {
      throw new Error(`Capability migration did not fail closed with the legacy disclosure identity: ${unsafeDisclosureError}`);
    }

    await preCorrection.query(`TRUNCATE "KnowledgeBaseDisclosure" CASCADE`);
    await preCorrection.query(capabilityMigration);
    appliedMigrations.add("20260810260000_capability_ledger_projection");
    const preservedDefinition = await preCorrection.query(
      `SELECT definition."code", version."version", version."pathPattern", version."valueKind"
       FROM "CapabilityDefinition" definition
       JOIN "CapabilityDefinitionVersion" version USING ("capabilityDefinitionId")
       WHERE definition."capabilityDefinitionId" = 'legacy-counter-definition'`,
    );
    if (JSON.stringify(preservedDefinition.rows) !== JSON.stringify([
      { code: "legacy-counter", version: 1, pathPattern: "legacy-counter", valueKind: "COUNTER" },
    ])) {
      throw new Error(`Legacy concrete CapabilityDefinition was not preserved losslessly: ${JSON.stringify(preservedDefinition.rows)}`);
    }

    await applyThrough("20260810270000_campaign_book_groupings");
    await preCorrection.query(
      `INSERT INTO "Matrix" ("matrixId", "regionId", "latticeId", "culturePoolIds")
       VALUES ('polluted-matrix-row', 'R01', 'L01', ARRAY['CP01']::"CulturePoolId"[])`,
    );
    await applyThrough("20260810280000_atlas_region_lattice_topology");
    const removedMatrix = await preCorrection.query(`SELECT to_regclass('public."Matrix"') AS matrix`);
    if (removedMatrix.rows[0]?.matrix !== null) throw new Error("Forward Atlas migration did not remove the polluted Matrix table");
    await applyThrough("20260810290000_external_bulk_api_audit");
    await applyThrough("20260811010000_resolved_blockers_application_contracts");
    await applyThrough("20260812023000_soundtrack_asset_reuse");

    await preCorrection.query(
      `INSERT INTO "Species" ("speciesId", "name", "speciesKind", "appearance", "anthropomorphization")
       VALUES ('legacy-species', 'Legacy Species', 'HUMAN', ARRAY['first appearance', 'second appearance'], ARRAY['first form', 'second form'])`,
    );
    await preCorrection.query(
      `INSERT INTO "Culture" (
         "cultureId", "culturePoolId", "cultureName", "hamletArchitecture", "villageArchitecture",
         "townArchitecture", "cityArchitecture", "metropolisArchitecture", "architectureColorPalette", "clothingPalette", "clothing"
       ) VALUES (
         'legacy-culture', 'CP01', 'Legacy Culture', 'hamlet text', 'village text', 'town text', 'city text', 'metropolis text',
         ARRAY['ochre', 'slate'], ARRAY['indigo', 'gold'], 'woven layers'
       )`,
    );
    await preCorrection.query(
      `INSERT INTO "Breed" ("breedId", "name", "speciesId", "cultureId", "appearance", "accent", "costume", "architecture")
       VALUES ('legacy-breed', 'Legacy Breed', 'legacy-species', 'legacy-culture', ARRAY['fur', 'scales'], ARRAY['low', 'musical'], ARRAY['robe', 'sash'], ARRAY['arches', 'courts'])`,
    );
    await preCorrection.query(`INSERT INTO "Soul" ("soulId", "name") VALUES ('legacy-soul', 'Legacy Soul')`);
    await preCorrection.query(`INSERT INTO "Occupation" ("occupationId", "name") VALUES ('legacy-occupation', 'Legacy Occupation')`);
    await preCorrection.query(
      `INSERT INTO "Character" ("characterId", "displayName", "breedId") VALUES
       ('legacy-character-concord', 'Legacy Concord', 'legacy-breed'),
       ('legacy-character-ruin', 'Legacy Ruin', 'legacy-breed'),
       ('legacy-character-schism', 'Legacy Schism', 'legacy-breed')`,
    );
    await preCorrection.query(
      `INSERT INTO "Protagonist" (
         "protagonistId", "characterId", "importance", "worldKey", "gender", "age", "occupationId",
         "knowledgeSkill", "awarenessSkill", "faction", "primaryAttribute", "secondaryAttribute", "worldHeirloom"
       ) VALUES
       ('legacy-protagonist-concord', 'legacy-character-concord', 'MAJOR', 'CONCORD', 'Woman', 30, 'legacy-occupation', 'LORE', 'EMPATHY', 'CONCORD', 'INTELLIGENCE', 'WISDOM', 'NECKLACE'),
       ('legacy-protagonist-ruin', 'legacy-character-ruin', 'MAJOR', 'RUIN', 'Woman', 30, 'legacy-occupation', 'LORE', 'EMPATHY', 'RUIN', 'INTELLIGENCE', 'WISDOM', 'NECKLACE'),
       ('legacy-protagonist-schism', 'legacy-character-schism', 'MAJOR', 'SCHISM', 'Woman', 30, 'legacy-occupation', 'LORE', 'EMPATHY', 'SCHISM', 'INTELLIGENCE', 'WISDOM', 'NECKLACE')`,
    );
    await preCorrection.query(
      `INSERT INTO "Companion" ("companionKey", "concordProtagonistId", "ruinProtagonistId", "schismProtagonistId", "soulId", "heirloom")
       VALUES ('A', 'legacy-protagonist-concord', 'legacy-protagonist-ruin', 'legacy-protagonist-schism', 'legacy-soul', 'NECKLACE')`,
    );

    const correctiveMigration = await readFile(resolve(migrationsRoot, "20260813160000_canonical_type_unification", "migration.sql"), "utf8");
    await preCorrection.query(`INSERT INTO "Architect" ("architectId", "departmentId", "name") VALUES ('ambiguous-architect', 'UNKNOWN', 'Ambiguous')`);
    let ambiguousTypeError = "";
    try {
      await preCorrection.query(correctiveMigration);
    } catch (error) {
      ambiguousTypeError = error instanceof Error ? error.message : String(error);
    }
    if (!ambiguousTypeError.includes("architectRowsWithoutCharacterAuthority")) {
      throw new Error(`Canonical type migration did not fail closed with a machine-readable Architect blocker: ${ambiguousTypeError}`);
    }
    await preCorrection.query(`DELETE FROM "Architect" WHERE "architectId" = 'ambiguous-architect'`);
    await applyThrough("20260813160000_canonical_type_unification");
    await applyThrough("20260814190000_worldbuilding_v3_expand_backfill");

    const contractMigration = await readFile(resolve(migrationsRoot, "20260814191000_worldbuilding_v3_contract_retire", "migration.sql"), "utf8");
    let worldbuildingBlocker = "";
    try {
      await preCorrection.query(contractMigration);
    } catch (error) {
      worldbuildingBlocker = error instanceof Error ? error.message : String(error);
    }
    if (!worldbuildingBlocker.includes("breedMissingGroupId") || !worldbuildingBlocker.includes("characterMissingRequiredStrings")) {
      throw new Error(`WorldBuilding v3 contract did not fail closed with required backfill classes: ${worldbuildingBlocker}`);
    }
    await preCorrection.query(
      `UPDATE "Breed" SET "groupIdV3"='H01', "personalityIdV3"='ACCOUNTABILITY_CURSE_EXCUSE_CONFLICT' WHERE "breedId"='legacy-breed'`,
    );
    await preCorrection.query(
      `UPDATE "Character" SET "skinScaleColorV3"='umber', "hairFurColorV3"='black', "eyeColorV3"='brown', "clothingV3"='travel clothes' WHERE "characterId" LIKE 'legacy-character-%'`,
    );
    await applyThrough("20260814191000_worldbuilding_v3_contract_retire");

    await preCorrection.query(
      `INSERT INTO "Character" ("characterId", "displayName", "breedId", "age", "skinScaleColor", "hairFurColor", "eyeColor", "clothing") VALUES
       ('shared-pk-architect-character', 'Shared PK Architect', 'legacy-breed', '40', 'umber', 'black', 'brown', 'tailored layers'),
       ('shared-pk-witness-character', 'Shared PK Witness', 'legacy-breed', '35', 'bronze', 'black', 'green', 'ceremonial layers')`,
    );
    await preCorrection.query(
      `INSERT INTO "Architect" ("architectId", "characterId", "department", "profession")
       VALUES ('legacy-independent-architect-id', 'shared-pk-architect-character', 'NAVIGATION', NULL)`,
    );
    await preCorrection.query(
      `INSERT INTO "WitnessDef" ("witnessDefId", "name", "department", "apparentDomain", "realDomain", "color")
       VALUES ('shared-pk-witness-def', 'The Anchor', 'NAVIGATION', 'Currents', 'Memory', 'BLUE')`,
    );
    await preCorrection.query(
      `INSERT INTO "LegendaryReward" ("legendaryRewardId", "name", "description")
       VALUES ('shared-pk-reward', 'The Lantern', 'A migration verification reward')`,
    );
    await preCorrection.query(
      `INSERT INTO "Witness" ("witnessId", "characterId", "witnessDefId", "trueFlawName", "architectId", "legendaryRewardId")
       VALUES ('legacy-independent-witness-id', 'shared-pk-witness-character', 'shared-pk-witness-def', 'Certainty', 'legacy-independent-architect-id', 'shared-pk-reward')`,
    );

    const subtypeMigration = await readFile(resolve(migrationsRoot, "20260814192000_character_subtype_shared_primary_keys", "migration.sql"), "utf8");
    await preCorrection.query(`ALTER TABLE "Witness" DROP CONSTRAINT "Witness_architectId_fkey"`);
    await preCorrection.query(`UPDATE "Witness" SET "architectId"='unmapped-architect' WHERE "witnessId"='legacy-independent-witness-id'`);
    let subtypeBlocker = "";
    try {
      await preCorrection.query(subtypeMigration);
    } catch (error) {
      subtypeBlocker = error instanceof Error ? error.message : String(error);
    }
    if (!subtypeBlocker.includes("CHARACTER_SUBTYPE_INHERITANCE_BLOCKER") || !subtypeBlocker.includes("unmappedWitnessArchitects=1")) {
      throw new Error(`Character subtype migration did not fail closed with its unmapped relation count: ${subtypeBlocker}`);
    }
    await preCorrection.query(`UPDATE "Witness" SET "architectId"='legacy-independent-architect-id' WHERE "witnessId"='legacy-independent-witness-id'`);
    await preCorrection.query(
      `ALTER TABLE "Witness" ADD CONSTRAINT "Witness_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "Architect"("architectId") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await applyThrough("20260814192000_character_subtype_shared_primary_keys");
    await applyThrough("20260815103000_breed_population_kind");
    await applyThrough("20260815124500_breed_parent_hierarchy");

    await preCorrection.query(`INSERT INTO "Soul" ("soulId", "name") VALUES ('shared-soul-architect', 'Architect Soul'), ('shared-soul-witness', 'Witness Soul')`);
    await preCorrection.query(`UPDATE "Character" SET "soulId"='shared-soul-architect' WHERE "characterId"='shared-pk-architect-character'`);
    await preCorrection.query(`UPDATE "Character" SET "soulId"='shared-soul-witness' WHERE "characterId"='shared-pk-witness-character'`);
    const continuityMigration = await readFile(resolve(migrationsRoot, "20260815150000_architect_witness_soul_continuity", "migration.sql"), "utf8");
    let continuityBlocker = "";
    try {
      await preCorrection.query(continuityMigration);
    } catch (error) {
      continuityBlocker = error instanceof Error ? error.message : String(error);
    }
    if (!continuityBlocker.includes("ARCHITECT_WITNESS_CANON_BLOCKER") || !continuityBlocker.includes("invalidSoulChains=1")) {
      throw new Error(`Architect/Witness Soul migration did not fail closed with its mismatch count: ${continuityBlocker}`);
    }
    await preCorrection.query(`UPDATE "Character" SET "soulId"='shared-soul-architect' WHERE "characterId"='shared-pk-witness-character'`);
    await applyThrough("20260815150000_architect_witness_soul_continuity");
    await applyThrough("20260815153000_culture_independent_root");

    const remappedSubtype = await preCorrection.query(
      `SELECT witness."characterId" AS "witnessCharacterId", witness."architectCharacterId", architect."characterId" AS "resolvedArchitectCharacterId"
       FROM "Witness" witness JOIN "Architect" architect ON architect."characterId" = witness."architectCharacterId"
       WHERE witness."characterId"='shared-pk-witness-character'`,
    );
    if (JSON.stringify(remappedSubtype.rows) !== JSON.stringify([{
      witnessCharacterId: "shared-pk-witness-character",
      architectCharacterId: "shared-pk-architect-character",
      resolvedArchitectCharacterId: "shared-pk-architect-character",
    }])) {
      throw new Error(`Witness Architect relation was not remapped to Character identity: ${JSON.stringify(remappedSubtype.rows)}`);
    }

    await expectDatabaseRejection(
      () => preCorrection.query(
        `INSERT INTO "Witness" ("characterId", "witnessDefId", "trueFlawName", "architectCharacterId", "legendaryRewardId")
         VALUES ('shared-pk-witness-character', 'shared-pk-witness-def', 'Duplicate', 'shared-pk-architect-character', 'shared-pk-reward')`,
      ),
      "A second Witness subtype row for one Character was not rejected",
    );
    await expectDatabaseRejection(
      () => preCorrection.query(
        `INSERT INTO "Witness" ("characterId", "witnessDefId", "trueFlawName", "architectCharacterId", "legendaryRewardId")
         VALUES ('missing-character', 'shared-pk-witness-def', 'Orphan', 'shared-pk-architect-character', 'shared-pk-reward')`,
      ),
      "An orphan Witness subtype row was not rejected",
    );
    await preCorrection.query(`DELETE FROM "Witness" WHERE "characterId"='shared-pk-witness-character'`);
    const witnessParentAfterSubtypeDelete = await preCorrection.query(`SELECT count(*)::int AS count FROM "Character" WHERE "characterId"='shared-pk-witness-character'`);
    if (witnessParentAfterSubtypeDelete.rows[0]?.count !== 1) throw new Error("Deleting Witness incorrectly deleted Character");
    await preCorrection.query(
      `INSERT INTO "Witness" ("characterId", "witnessDefId", "trueFlawName", "architectCharacterId", "legendaryRewardId")
       VALUES ('shared-pk-witness-character', 'shared-pk-witness-def', 'Certainty', 'shared-pk-architect-character', 'shared-pk-reward')`,
    );
    await preCorrection.query(`DELETE FROM "Character" WHERE "characterId"='shared-pk-witness-character'`);
    const witnessAfterParentDelete = await preCorrection.query(`SELECT count(*)::int AS count FROM "Witness" WHERE "characterId"='shared-pk-witness-character'`);
    if (witnessAfterParentDelete.rows[0]?.count !== 0) throw new Error("Deleting Character did not cascade to Witness");

    await preCorrection.query(
      `INSERT INTO "Character" ("characterId", "displayName", "breedId", "age", "skinScaleColor", "hairFurColor", "eyeColor", "clothing")
       VALUES ('standalone-architect-character', 'Standalone Architect', 'legacy-breed', '44', 'umber', 'gray', 'brown', 'working layers')`,
    );
    await preCorrection.query(`INSERT INTO "Architect" ("characterId", "department") VALUES ('standalone-architect-character', 'COMPUTING')`);
    await expectDatabaseRejection(
      () => preCorrection.query(`INSERT INTO "Architect" ("characterId", "department") VALUES ('standalone-architect-character', 'SOFTWARE')`),
      "A second Architect subtype row for one Character was not rejected",
    );
    await expectDatabaseRejection(
      () => preCorrection.query(`INSERT INTO "Architect" ("characterId", "department") VALUES ('missing-architect-character', 'SOFTWARE')`),
      "An orphan Architect subtype row was not rejected",
    );
    await preCorrection.query(`DELETE FROM "Architect" WHERE "characterId"='standalone-architect-character'`);
    const architectParentAfterSubtypeDelete = await preCorrection.query(`SELECT count(*)::int AS count FROM "Character" WHERE "characterId"='standalone-architect-character'`);
    if (architectParentAfterSubtypeDelete.rows[0]?.count !== 1) throw new Error("Deleting Architect incorrectly deleted Character");
    await preCorrection.query(`INSERT INTO "Architect" ("characterId", "department") VALUES ('standalone-architect-character', 'COMPUTING')`);
    await preCorrection.query(`DELETE FROM "Character" WHERE "characterId"='standalone-architect-character'`);
    const architectAfterParentDelete = await preCorrection.query(`SELECT count(*)::int AS count FROM "Architect" WHERE "characterId"='standalone-architect-character'`);
    if (architectAfterParentDelete.rows[0]?.count !== 0) throw new Error("Deleting Character did not cascade to Architect");

    await preCorrection.query(
      `INSERT INTO "Character" ("characterId", "displayName", "breedId", "age", "skinScaleColor", "hairFurColor", "eyeColor", "clothing")
       VALUES ('standalone-companion-character', 'Standalone Companion', 'legacy-breed', '29', 'umber', 'black', 'brown', 'travel layers')`,
    );
    await preCorrection.query(`INSERT INTO "Companion" ("characterId", "companionKey") VALUES ('standalone-companion-character', 'A')`);
    await expectDatabaseRejection(
      () => preCorrection.query(`INSERT INTO "Companion" ("characterId", "companionKey") VALUES ('standalone-companion-character', 'A')`),
      "A second Companion subtype row for one Character was not rejected",
    );
    await expectDatabaseRejection(
      () => preCorrection.query(`INSERT INTO "Companion" ("characterId", "companionKey") VALUES ('missing-companion-character', 'A')`),
      "An orphan Companion subtype row was not rejected",
    );
    await preCorrection.query(`DELETE FROM "Companion" WHERE "characterId"='standalone-companion-character'`);
    const companionParentAfterSubtypeDelete = await preCorrection.query(`SELECT count(*)::int AS count FROM "Character" WHERE "characterId"='standalone-companion-character'`);
    if (companionParentAfterSubtypeDelete.rows[0]?.count !== 1) throw new Error("Deleting Companion incorrectly deleted Character");
    await preCorrection.query(`INSERT INTO "Companion" ("characterId", "companionKey") VALUES ('standalone-companion-character', 'A')`);
    await preCorrection.query(`DELETE FROM "Character" WHERE "characterId"='standalone-companion-character'`);
    const companionAfterParentDelete = await preCorrection.query(`SELECT count(*)::int AS count FROM "Companion" WHERE "characterId"='standalone-companion-character'`);
    if (companionAfterParentDelete.rows[0]?.count !== 0) throw new Error("Deleting Character did not cascade to Companion");

    const migratedCompanion = await preCorrection.query(
      `SELECT definition."companionKey", definition."soulId", count(companion."characterId")::int AS "concreteCount"
       FROM "CompanionDef" definition JOIN "Companion" companion USING ("companionKey")
       WHERE definition."companionKey" = 'A' GROUP BY definition."companionKey", definition."soulId"`,
    );
    const migratedCharacters = await preCorrection.query(
      `SELECT "characterId", "worldKey", "soulId", "occupationId", "gender", "age", "faction", "primaryAttribute", "secondaryAttribute"
       FROM "Character" WHERE "characterId" LIKE 'legacy-character-%' ORDER BY "worldKey"`,
    );
    if (JSON.stringify(migratedCompanion.rows) !== JSON.stringify([{ companionKey: "A", soulId: "legacy-soul", concreteCount: 3 }])
      || migratedCharacters.rows.length !== 3
      || migratedCharacters.rows.some((row) => row.soulId !== "legacy-soul" || row.occupationId !== "legacy-occupation" || row.gender !== "Woman" || row.age !== "30")) {
      throw new Error(`Representative Protagonist/Companion rows were not migrated losslessly: ${JSON.stringify({ migratedCompanion: migratedCompanion.rows, migratedCharacters: migratedCharacters.rows })}`);
    }

    const presentation = await preCorrection.query(
      `SELECT s."appearance" AS "speciesAppearance", s."anthropomorphization", b."appearance" AS "breedAppearance", b."accent", b."clothing", b."architecture",
              c."name" AS "cultureName", c."architecture" AS "cultureArchitecture", c."clothing" AS "cultureClothing"
       FROM "Breed" b JOIN "Species" s USING ("speciesId") JOIN "Culture" c USING ("cultureId") WHERE b."breedId"='legacy-breed'`,
    );
    const preserved = presentation.rows[0];
    if (preserved?.speciesAppearance !== "first appearance; second appearance"
      || preserved?.anthropomorphization !== "first form; second form"
      || preserved?.breedAppearance !== "fur; scales" || preserved?.accent !== "low; musical"
      || preserved?.clothing !== "robe; sash" || preserved?.architecture !== "arches; courts"
      || preserved?.cultureName !== "Legacy Culture"
      || !preserved?.cultureArchitecture.includes("Hamlet: hamlet text")
      || !preserved?.cultureArchitecture.includes("Architecture palette: ochre, slate")
      || !preserved?.cultureClothing.includes("Clothing: woven layers")
      || !preserved?.cultureClothing.includes("Clothing palette: indigo, gold")) {
      throw new Error(`WorldBuilding legacy presentation was not preserved exactly: ${JSON.stringify(presentation.rows)}`);
    }
    const worldbuildingCatalog = await preCorrection.query(
      `SELECT (SELECT count(*)::int FROM "PersonalityExpression") AS personalities,
              to_regclass('public."SpeciesGroup"') AS "speciesGroup",
              EXISTS (SELECT 1 FROM pg_type WHERE typname='SpecificTerrain') AS "specificTerrain",
              EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='EntityType' AND e.enumlabel='SPECIES_GROUP') AS "speciesGroupEntityType"`,
    );
    if (JSON.stringify(worldbuildingCatalog.rows[0]) !== JSON.stringify({ personalities: 369, speciesGroup: null, specificTerrain: true, speciesGroupEntityType: false })) {
      throw new Error(`WorldBuilding v3 retirement/catalog verification failed: ${JSON.stringify(worldbuildingCatalog.rows)}`);
    }

    const canonicalWitnessMigration = await readFile(resolve(migrationsRoot, "20260816000000_architect_witness_guide_canon", "migration.sql"), "utf8");
    let witnessDefinitionBlocker = "";
    try {
      await preCorrection.query(canonicalWitnessMigration);
    } catch (error) {
      witnessDefinitionBlocker = error instanceof Error ? error.message : String(error);
    }
    if (!witnessDefinitionBlocker.includes("WITNESS_DEF_CANONICAL_MIGRATION_BLOCKER")) {
      throw new Error(`Canonical WitnessDef migration did not fail closed on legacy definitions: ${witnessDefinitionBlocker}`);
    }
    await preCorrection.query(`DELETE FROM "Witness"`);
    await preCorrection.query(`DELETE FROM "WitnessDef"`);
    await applyThrough("20260816000000_architect_witness_guide_canon");
    const emptyDocumentTables = await preCorrection.query(
      `SELECT (SELECT count(*)::int FROM "DocumentBucket") AS bucket,
              (SELECT count(*)::int FROM "DocumentSourcePoint") AS source_point,
              (SELECT count(*)::int FROM "DocumentAmendment") AS amendment,
              (SELECT count(*)::int FROM "DocumentDraft") AS draft`,
    );
    if (Object.values(emptyDocumentTables.rows[0] ?? {}).some((value) => value !== 0)) {
      throw new Error(`Document remediation empty-table path fixture is not empty: ${JSON.stringify(emptyDocumentTables.rows)}`);
    }
    await applyThrough("20260816003000_bulk_api_and_document_bucket_remediation");
    const retiredDocumentTables = await preCorrection.query(
      `SELECT to_regclass('public."DocumentBucket"') AS bucket,
              to_regclass('public."DocumentSourcePoint"') AS source_point,
              to_regclass('public."DocumentAmendment"') AS amendment,
              to_regclass('public."DocumentDraft"') AS draft`,
    );
    if (Object.values(retiredDocumentTables.rows[0] ?? {}).some((value) => value !== null)) {
      throw new Error(`Unauthorized Document Builder tables remain after remediation: ${JSON.stringify(retiredDocumentTables.rows)}`);
    }

    await applyThrough("20260820101500_taxonomy_relational_normalization");
    await preCorrection.query(
      `INSERT INTO "PuzzleBlueprint" ("puzzleBlueprintId", "title", "primaryFamily", "difficultyTier") VALUES
       ('PZB-011', 'Legacy 011', 'CRYPTO_NUMERIC_DATA', 'TIER_1_INITIATE'),
       ('PZB-012', 'Legacy 012', 'LOGIC_CONSTRAINT', 'TIER_1_INITIATE'),
       ('PZB-021', 'Legacy 021', 'VISUAL_COLOR_OPTICAL', 'TIER_2_ADEPT'),
       ('PZB-037', 'Legacy 037', 'AUDIO_MUSIC_SPECTRAL', 'TIER_3_EXPERT')`,
    );
    await preCorrection.query("BEGIN");
    await preCorrection.query(
      `INSERT INTO "PuzzleBlueprintVersion" ("puzzleBlueprintId", "generatorVersion", "design") VALUES
       ('PZB-011', '1.0.0', '{"schemaVersion":"puzzle-blueprint-design-v1","legacyMarker":"PZB-011"}'::jsonb),
       ('PZB-012', '1.0.0', '{"schemaVersion":"puzzle-blueprint-design-v1","legacyMarker":"PZB-012"}'::jsonb),
       ('PZB-021', '1.0.0', '{"schemaVersion":"puzzle-blueprint-design-v1","legacyMarker":"PZB-021"}'::jsonb),
       ('PZB-037', '1.0.0', '{"schemaVersion":"puzzle-blueprint-design-v1","legacyMarker":"PZB-037"}'::jsonb)`,
    );
    await preCorrection.query(
      `INSERT INTO "PuzzleHintTemplate" ("puzzleBlueprintId", "generatorVersion", "level", "kind", "template")
       SELECT id, '1.0.0', level, CASE level WHEN 1 THEN 'DIRECTIONAL'::"PuzzleHintKind" ELSE 'GUIDED'::"PuzzleHintKind" END, 'Legacy hint'
       FROM unnest(ARRAY['PZB-011','PZB-012','PZB-021','PZB-037']) AS id CROSS JOIN generate_series(1, 2) AS level`,
    );
    await preCorrection.query("COMMIT");
    await applyThrough("20260826120000_member_puzzle_production_versions");
    const upgradedPuzzleVersions = await preCorrection.query(
      `SELECT
         count(*) FILTER (WHERE "generatorVersion"='1.0.0')::int AS base_count,
         count(*) FILTER (WHERE "generatorVersion"='1.1.0')::int AS target_count,
         count(*) FILTER (WHERE "generatorVersion"='1.1.0' AND "design"->>'legacyMarker'="puzzleBlueprintId")::int AS preserved_count
       FROM "PuzzleBlueprintVersion" WHERE "puzzleBlueprintId" IN ('PZB-011','PZB-012','PZB-021','PZB-037')`,
    );
    const upgradedPuzzleHints = await preCorrection.query(
      `SELECT count(*)::int AS count FROM "PuzzleHintTemplate"
       WHERE "puzzleBlueprintId" IN ('PZB-011','PZB-012','PZB-021','PZB-037') AND "generatorVersion"='1.1.0'`,
    );
    if (JSON.stringify(upgradedPuzzleVersions.rows[0]) !== JSON.stringify({ base_count: 4, target_count: 4, preserved_count: 4 })
      || upgradedPuzzleHints.rows[0]?.count !== 8) {
      throw new Error(`Populated Puzzle upgrade did not append exactly four immutable versions and eight hints: ${JSON.stringify({ versions: upgradedPuzzleVersions.rows, hints: upgradedPuzzleHints.rows })}`);
    }

    const preCorrectionEnvironment = { ...process.env, DATABASE_URL: preCorrectionUrl.toString() };
    await run("pnpm", [
      "exec", "prisma", "migrate", "diff",
      "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code",
    ], preCorrectionEnvironment);
  } finally {
    await preCorrection.end();
  }

  await admin.query(`CREATE DATABASE "${documentGuardDatabaseName}"`);
  const documentGuard = new Client({ connectionString: documentGuardUrl.toString() });
  await documentGuard.connect();
  try {
    const migrationsRoot = resolve(import.meta.dirname, "../prisma/migrations");
    const migrations = (await readdir(migrationsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const migration of migrations.filter((name) => name <= "20260816000000_architect_witness_guide_canon")) {
      await documentGuard.query(await readFile(resolve(migrationsRoot, migration, "migration.sql"), "utf8"));
    }
    await documentGuard.query(
      `INSERT INTO "User" ("id", "name", "email", "eligibilityStatus", "updatedAt")
       VALUES ('document-guard-user', 'Document Guard User', 'document-guard@example.test', 'ADULT_18_PLUS', CURRENT_TIMESTAMP)`,
    );
    await documentGuard.query(`INSERT INTO "DocumentBucket" ("documentBucketId", "name") VALUES ('preserved-bucket', 'Preserved bucket')`);
    await documentGuard.query(
      `INSERT INTO "DocumentSourcePoint" ("documentSourcePointId", "documentBucketId", "ordinal", "content", "sourceLabel")
       VALUES ('preserved-source', 'preserved-bucket', 0, 'Preserved source', 'Owner source')`,
    );
    await documentGuard.query(
      `INSERT INTO "DocumentAmendment" ("documentAmendmentId", "documentBucketId", "ordinal", "content")
       VALUES ('preserved-amendment', 'preserved-bucket', 0, 'Preserved amendment')`,
    );
    await documentGuard.query(
      `INSERT INTO "DocumentDraft" ("documentDraftId", "documentBucketId", "version", "content", "sourcePointIds", "amendmentIds", "authoredByUserId")
       VALUES ('preserved-draft', 'preserved-bucket', 1, 'Preserved draft', ARRAY['preserved-source'], ARRAY['preserved-amendment'], 'document-guard-user')`,
    );
    const remediationMigration = await readFile(
      resolve(migrationsRoot, "20260816003000_bulk_api_and_document_bucket_remediation", "migration.sql"),
      "utf8",
    );
    let guardError = "";
    try {
      await documentGuard.query(remediationMigration);
    } catch (error) {
      guardError = error instanceof Error ? error.message : String(error);
    }
    if (!guardError.includes("Refusing to remove superseded DocumentBucket persistence because Document* rows exist")) {
      throw new Error(`Document remediation did not fail closed with the required diagnostic: ${guardError}`);
    }
    const preservedDocumentRows = await documentGuard.query(
      `SELECT to_regclass('public."DocumentBucket"') IS NOT NULL AS bucket_table,
              to_regclass('public."DocumentSourcePoint"') IS NOT NULL AS source_table,
              to_regclass('public."DocumentAmendment"') IS NOT NULL AS amendment_table,
              to_regclass('public."DocumentDraft"') IS NOT NULL AS draft_table,
              (SELECT count(*)::int FROM "DocumentBucket") AS bucket_rows,
              (SELECT count(*)::int FROM "DocumentSourcePoint") AS source_rows,
              (SELECT count(*)::int FROM "DocumentAmendment") AS amendment_rows,
              (SELECT count(*)::int FROM "DocumentDraft") AS draft_rows`,
    );
    const preserved = preservedDocumentRows.rows[0];
    if (!preserved?.bucket_table || !preserved.source_table || !preserved.amendment_table || !preserved.draft_table
      || preserved.bucket_rows !== 1 || preserved.source_rows !== 1 || preserved.amendment_rows !== 1 || preserved.draft_rows !== 1) {
      throw new Error(`Document remediation failure did not preserve all tables and rows: ${JSON.stringify(preservedDocumentRows.rows)}`);
    }
    process.stdout.write("Document remediation safety verified: empty path succeeds; persisted-data path refuses and preserves all four tables and rows.\n");
  } finally {
    await documentGuard.end();
  }
} finally {
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.query(`DROP DATABASE IF EXISTS "${preCorrectionDatabaseName}" WITH (FORCE)`);
  await admin.query(`DROP DATABASE IF EXISTS "${documentGuardDatabaseName}" WITH (FORCE)`);
  await admin.end();
}
