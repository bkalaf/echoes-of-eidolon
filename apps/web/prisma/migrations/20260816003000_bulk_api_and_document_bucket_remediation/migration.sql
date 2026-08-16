DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ExternalBulkApiSession" WHERE NOT (
    ("state" = 'KEYED' AND "revokedAt" IS NULL AND "keyHash" IS NOT NULL AND length("keyHash") = 64)
    OR ("state" = 'KEYLESS' AND "revokedAt" IS NULL AND "keyHash" IS NULL)
    OR ("state" = 'OFF' AND "revokedAt" IS NOT NULL)
  )) THEN
    RAISE EXCEPTION 'EXTERNAL_BULK_API_STATE_RECONCILIATION_BLOCKER: existing rows violate KEYED, KEYLESS, or OFF semantics';
  END IF;

  IF EXISTS (SELECT 1 FROM "ExternalBulkApiSession" WHERE "keyHash" IS NOT NULL AND length("keyHash") <> 64) THEN
    RAISE EXCEPTION 'EXTERNAL_BULK_API_KEY_HASH_RECONCILIATION_BLOCKER: existing key hashes must be 64 characters';
  END IF;

  IF EXISTS (SELECT 1 FROM "DocumentBucket")
    OR EXISTS (SELECT 1 FROM "DocumentSourcePoint")
    OR EXISTS (SELECT 1 FROM "DocumentAmendment")
    OR EXISTS (SELECT 1 FROM "DocumentDraft") THEN
    RAISE EXCEPTION 'Refusing to remove superseded DocumentBucket persistence because Document* rows exist';
  END IF;
END $$;

ALTER TABLE "ExternalBulkApiSession" DROP CONSTRAINT "ExternalBulkApiSession_state_check";
ALTER TABLE "ExternalBulkApiSession" DROP CONSTRAINT "ExternalBulkApiSession_key_hash_check";

ALTER TABLE "ExternalBulkApiSession" ADD CONSTRAINT "ExternalBulkApiSession_state_check" CHECK (
  ("state" = 'KEYED' AND "revokedAt" IS NULL AND "keyHash" IS NOT NULL AND length("keyHash") = 64)
  OR ("state" = 'KEYLESS' AND "revokedAt" IS NULL AND "keyHash" IS NULL)
  OR ("state" = 'OFF' AND "revokedAt" IS NOT NULL)
);

ALTER TABLE "ExternalBulkApiSession" ADD CONSTRAINT "ExternalBulkApiSession_key_hash_check" CHECK (
  "keyHash" IS NULL OR length("keyHash") = 64
);

DROP TRIGGER IF EXISTS "DocumentDraft_reject_update" ON "DocumentDraft";
DROP FUNCTION IF EXISTS reject_versioned_document_mutation();
DROP TABLE "DocumentDraft";
DROP TABLE "DocumentAmendment";
DROP TABLE "DocumentSourcePoint";
DROP TABLE "DocumentBucket";
DROP TYPE "DocumentDraftStatus";
