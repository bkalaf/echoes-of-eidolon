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
  } finally {
    await verification.end();
  }
} finally {
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.end();
}
