ALTER TYPE "ExternalBulkApiState" RENAME VALUE 'ON' TO 'KEYED';
ALTER TYPE "ExternalBulkApiState" ADD VALUE IF NOT EXISTS 'KEYLESS';
ALTER TABLE "ExternalBulkApiSession" ALTER COLUMN "state" SET DEFAULT 'OFF';
CREATE TYPE "BulkMutationStatus" AS ENUM ('RECEIVED', 'DRY_RUN_RUNNING', 'DRY_RUN_FAILED', 'PENDING_REVIEW', 'APPLYING', 'REVALIDATION_FAILED', 'APPLIED', 'DELETED');

ALTER TABLE "ExternalBulkApiSession" ALTER COLUMN "keyHash" DROP NOT NULL;
ALTER TABLE "ExternalBulkApiSession" ADD COLUMN "lastActivityAt" TIMESTAMP(3);
UPDATE "ExternalBulkApiSession" SET "lastActivityAt" = "createdAt" WHERE "lastActivityAt" IS NULL;
ALTER TABLE "ExternalBulkApiSession" ALTER COLUMN "lastActivityAt" SET NOT NULL;
DROP INDEX IF EXISTS "ExternalBulkApiSession_state_expiresAt_idx";
CREATE INDEX "ExternalBulkApiSession_state_lastActivityAt_idx" ON "ExternalBulkApiSession"("state", "lastActivityAt");

CREATE TABLE "BulkMutationEnvelope" (
  "bulkMutationEnvelopeId" TEXT NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "externalBulkApiSessionId" TEXT NOT NULL,
  "entityCode" TEXT NOT NULL,
  "operation" "BulkOperation" NOT NULL,
  "notes" TEXT NOT NULL,
  "recordCount" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "BulkMutationStatus" NOT NULL DEFAULT 'RECEIVED',
  "dryRunResult" JSONB NOT NULL,
  "revalidationResult" JSONB,
  "sourceMetadata" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "BulkMutationEnvelope_pkey" PRIMARY KEY ("bulkMutationEnvelopeId")
);
CREATE UNIQUE INDEX "BulkMutationEnvelope_sequence_key" ON "BulkMutationEnvelope"("sequence");
CREATE INDEX "BulkMutationEnvelope_status_sequence_idx" ON "BulkMutationEnvelope"("status", "sequence");
CREATE INDEX "BulkMutationEnvelope_externalBulkApiSessionId_receivedAt_idx" ON "BulkMutationEnvelope"("externalBulkApiSessionId", "receivedAt");
CREATE INDEX "BulkMutationEnvelope_decidedByUserId_idx" ON "BulkMutationEnvelope"("decidedByUserId");
ALTER TABLE "BulkMutationEnvelope" ADD CONSTRAINT "BulkMutationEnvelope_content_check" CHECK (length(trim("entityCode")) > 0 AND length(trim("notes")) BETWEEN 1 AND 2000 AND "recordCount" BETWEEN 1 AND 1000);
ALTER TABLE "BulkMutationEnvelope" ADD CONSTRAINT "BulkMutationEnvelope_decision_check" CHECK (("decidedByUserId" IS NULL AND "decidedAt" IS NULL) OR ("decidedByUserId" IS NOT NULL AND "decidedAt" IS NOT NULL));
ALTER TABLE "BulkMutationEnvelope" ADD CONSTRAINT "BulkMutationEnvelope_externalBulkApiSessionId_fkey" FOREIGN KEY ("externalBulkApiSessionId") REFERENCES "ExternalBulkApiSession"("externalBulkApiSessionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BulkMutationEnvelope" ADD CONSTRAINT "BulkMutationEnvelope_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BulkOperationAudit" ADD COLUMN "bulkMutationEnvelopeId" TEXT;
CREATE INDEX "BulkOperationAudit_bulkMutationEnvelopeId_idx" ON "BulkOperationAudit"("bulkMutationEnvelopeId");
ALTER TABLE "BulkOperationAudit" ADD CONSTRAINT "BulkOperationAudit_bulkMutationEnvelopeId_fkey" FOREIGN KEY ("bulkMutationEnvelopeId") REFERENCES "BulkMutationEnvelope"("bulkMutationEnvelopeId") ON DELETE SET NULL ON UPDATE CASCADE;
