import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
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
const adminUrl = new URL(configuredUrl);
adminUrl.pathname = "/postgres";
const verificationUrl = new URL(configuredUrl);
verificationUrl.pathname = `/${databaseName}`;
const admin = new Client({ connectionString: adminUrl.toString() });

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const environment = { ...process.env, DATABASE_URL: verificationUrl.toString() };
  await run("pnpm", ["exec", "prisma", "migrate", "deploy"], environment);
  await run("pnpm", [
    "exec", "prisma", "migrate", "diff",
    "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code",
  ], environment);

  const verification = new Client({ connectionString: verificationUrl.toString() });
  await verification.connect();
  try {
    const hash = "a".repeat(64);
    await verification.query(
      `INSERT INTO "ManagedAsset" ("managedAssetId", "sha256", "objectKey", "mediaKind", "mimeType", "byteSize")
       VALUES ($1, $1, $2, 'IMAGE', 'image/png', 1)`,
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
        `INSERT INTO "ManagedAsset" ("managedAssetId", "sha256", "objectKey", "mediaKind", "mimeType", "byteSize")
         VALUES ('invalid', $1, 'assets/not-the-hash.png', 'IMAGE', 'image/png', 1)`,
        ["b".repeat(64)],
      ),
      "ManagedAsset object-key mismatch was not rejected",
    );

    await verification.query(
      `INSERT INTO "User" ("id", "name", "email", "eligibilityStatus", "updatedAt")
       VALUES ('capability-user', 'Capability User', 'capability@example.test', 'ADULT_18_PLUS', CURRENT_TIMESTAMP)`,
    );
    await verification.query(
      `INSERT INTO "CapabilityDefinition" ("capabilityDefinitionId", "key", "valueKind", "description")
       VALUES ('capability-definition', 'verified-key', 'BOOLEAN', 'verification definition')`,
    );
    await verification.query(
      `INSERT INTO "CapabilityEvent" ("capabilityEventId", "userId", "capabilityDefinitionId", "sequence", "operation", "valueBoolean")
       VALUES ('capability-event', 'capability-user', 'capability-definition', 0, 'SET', true)`,
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "CapabilityEvent" ("capabilityEventId", "userId", "capabilityDefinitionId", "sequence", "operation", "valueBoolean")
         VALUES ('bad-capability-event', 'capability-user', 'capability-definition', 1, 'ADD', true)`,
      ),
      "Invalid BOOLEAN capability operation was not rejected",
    );
    await expectDatabaseRejection(
      () => verification.query(`UPDATE "CapabilityEvent" SET "valueBoolean" = false WHERE "capabilityEventId" = 'capability-event'`),
      "CapabilityEvent update was not rejected",
    );
    await expectDatabaseRejection(
      () => verification.query(`DELETE FROM "CapabilityEvent" WHERE "capabilityEventId" = 'capability-event'`),
      "CapabilityEvent delete was not rejected",
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
         "knowledgeBaseDisclosureId", "knowledgeBaseItemId", "capabilityDefinitionId", "ordinal", "operator",
         "requiredBoolean", "mode", "anchorBlockId"
       ) VALUES ('disclosure', 'knowledge-one', 'capability-definition', 0, 'EQ', true, 'REPLACE_BLOCK', 'block-one')`,
    );
    await expectDatabaseRejection(
      () => verification.query(
        `INSERT INTO "KnowledgeBaseDisclosure" (
           "knowledgeBaseDisclosureId", "knowledgeBaseItemId", "capabilityDefinitionId", "ordinal", "operator",
           "requiredBoolean", "mode", "anchorBlockId"
         ) VALUES ('bad-disclosure', 'knowledge-one', 'capability-definition', 1, 'EQ', true, 'REPLACE_BLOCK', 'block-two')`,
      ),
      "Cross-entry knowledge disclosure anchor was not rejected",
    );

    await verification.query(
      `INSERT INTO "PuzzleBlueprint" ("puzzleBlueprintId", "family", "difficultyTier")
       VALUES ('puzzle', 'LOGIC_CONSTRAINT', 'TIER_1_INITIATE')`,
    );
    await verification.query("BEGIN");
    await verification.query(
      `INSERT INTO "PuzzleBlueprintVersion" ("puzzleBlueprintId", "generatorVersion") VALUES ('puzzle', 0)`,
    );
    await verification.query(
      `INSERT INTO "PuzzleHintTemplate" ("puzzleBlueprintId", "generatorVersion", "level", "kind", "template") VALUES
       ('puzzle', 0, 1, 'DIRECTIONAL', 'Direction'),
       ('puzzle', 0, 2, 'GUIDED', 'Guide')`,
    );
    await verification.query("COMMIT");
    await expectTransactionRejection(
      verification,
      async () => {
        await verification.query(
          `INSERT INTO "PuzzleBlueprintVersion" ("puzzleBlueprintId", "generatorVersion") VALUES ('puzzle', 1)`,
        );
        await verification.query(
          `INSERT INTO "PuzzleHintTemplate" ("puzzleBlueprintId", "generatorVersion", "level", "kind", "template")
           VALUES ('puzzle', 1, 1, 'DIRECTIONAL', 'Only one')`,
        );
      },
      "PuzzleBlueprintVersion with one hint was not rejected",
    );
    await expectDatabaseRejection(
      () => verification.query(`UPDATE "PuzzleHintTemplate" SET "template" = 'Changed' WHERE "puzzleBlueprintId" = 'puzzle' AND "generatorVersion" = 0 AND "level" = 1`),
      "PuzzleHintTemplate update was not rejected",
    );
    await verification.query(
      `INSERT INTO "PuzzleChallengeAccepted" ("puzzleChallengeAcceptedId", "userId", "puzzleBlueprintId", "generatorVersion")
       VALUES ('acceptance', 'capability-user', 'puzzle', 0)`,
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
      `INSERT INTO "StoreProduct" ("storeProductId", "name", "active") VALUES ('store-product', 'Configured product', true)`,
    );
    await verification.query(
      `INSERT INTO "StoreVariant" (
         "storeVariantId", "storeProductId", "priceCents", "stripePriceReference", "printfulVariantReference", "available"
       ) VALUES ('store-variant', 'store-product', 1000, 'stripe-price', 'printful-variant', true)`,
    );
    await verification.query(
      `INSERT INTO "Order" ("orderId", "userId", "stripeCheckoutReference")
       VALUES ('store-order', 'capability-user', 'stripe-checkout')`,
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
  } finally {
    await verification.end();
  }
} finally {
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.end();
}
