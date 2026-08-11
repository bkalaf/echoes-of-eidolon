import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
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
const adminUrl = new URL(configuredUrl);
adminUrl.pathname = "/postgres";
const verificationUrl = new URL(configuredUrl);
verificationUrl.pathname = `/${databaseName}`;
const preCorrectionUrl = new URL(configuredUrl);
preCorrectionUrl.pathname = `/${preCorrectionDatabaseName}`;
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
      `INSERT INTO "Species" ("speciesId", "name", "speciesKind", "appearance", "anthropomorphization")
       VALUES ('species-research', 'Research Species', 'HUMAN', ARRAY[]::TEXT[], ARRAY[]::TEXT[])`,
    );
    await verification.query(
      `INSERT INTO "Breed" ("breedId", "name", "speciesId", "appearance", "accent", "costume", "architecture")
       VALUES ('breed-research', 'Research Breed', 'species-research', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[])`,
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
      `INSERT INTO "StoreProduct" ("storeProductId", "productType", "name", "active") VALUES ('store-product', 'POSTER', 'Configured product', true)`,
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

    const preCorrectionEnvironment = { ...process.env, DATABASE_URL: preCorrectionUrl.toString() };
    await run("pnpm", [
      "exec", "prisma", "migrate", "diff",
      "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code",
    ], preCorrectionEnvironment);
  } finally {
    await preCorrection.end();
  }
} finally {
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.query(`DROP DATABASE IF EXISTS "${preCorrectionDatabaseName}" WITH (FORCE)`);
  await admin.end();
}
