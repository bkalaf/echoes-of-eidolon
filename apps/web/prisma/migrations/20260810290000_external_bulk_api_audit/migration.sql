CREATE TABLE "ExternalBulkApiSession" (
  "externalBulkApiSessionId" TEXT NOT NULL,
  "issuedByUserId" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "state" "ExternalBulkApiState" NOT NULL DEFAULT 'ON',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalBulkApiSession_pkey" PRIMARY KEY ("externalBulkApiSessionId"),
  CONSTRAINT "ExternalBulkApiSession_expiry_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "ExternalBulkApiSession_key_hash_check" CHECK (length("keyHash") = 64),
  CONSTRAINT "ExternalBulkApiSession_state_check" CHECK (
    ("state" = 'ON' AND "revokedAt" IS NULL) OR
    ("state" = 'OFF' AND "revokedAt" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "ExternalBulkApiSession_keyHash_key" ON "ExternalBulkApiSession"("keyHash");
CREATE INDEX "ExternalBulkApiSession_state_expiresAt_idx" ON "ExternalBulkApiSession"("state", "expiresAt");
CREATE INDEX "ExternalBulkApiSession_issuedByUserId_idx" ON "ExternalBulkApiSession"("issuedByUserId");
ALTER TABLE "ExternalBulkApiSession" ADD CONSTRAINT "ExternalBulkApiSession_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BulkOperationAudit" (
  "bulkOperationAuditId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "externalBulkApiSessionId" TEXT,
  "operation" "BulkOperation" NOT NULL,
  "entityName" TEXT NOT NULL,
  "result" "ImportResultState" NOT NULL,
  "recordCount" INTEGER NOT NULL,
  "detail" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BulkOperationAudit_pkey" PRIMARY KEY ("bulkOperationAuditId"),
  CONSTRAINT "BulkOperationAudit_record_count_check" CHECK ("recordCount" >= 0),
  CONSTRAINT "BulkOperationAudit_actor_check" CHECK ("actorUserId" IS NOT NULL OR "externalBulkApiSessionId" IS NOT NULL)
);
CREATE INDEX "BulkOperationAudit_occurredAt_idx" ON "BulkOperationAudit"("occurredAt");
CREATE INDEX "BulkOperationAudit_actorUserId_idx" ON "BulkOperationAudit"("actorUserId");
CREATE INDEX "BulkOperationAudit_externalBulkApiSessionId_idx" ON "BulkOperationAudit"("externalBulkApiSessionId");
ALTER TABLE "BulkOperationAudit" ADD CONSTRAINT "BulkOperationAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BulkOperationAudit" ADD CONSTRAINT "BulkOperationAudit_externalBulkApiSessionId_fkey" FOREIGN KEY ("externalBulkApiSessionId") REFERENCES "ExternalBulkApiSession"("externalBulkApiSessionId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION "BulkOperationAudit_reject_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'BulkOperationAudit is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "BulkOperationAudit_reject_update" BEFORE UPDATE ON "BulkOperationAudit" FOR EACH ROW EXECUTE FUNCTION "BulkOperationAudit_reject_mutation"();
CREATE TRIGGER "BulkOperationAudit_reject_delete" BEFORE DELETE ON "BulkOperationAudit" FOR EACH ROW EXECUTE FUNCTION "BulkOperationAudit_reject_mutation"();

CREATE FUNCTION "ExternalBulkApiSession_protect"() RETURNS trigger AS $$
BEGIN
  IF NEW."externalBulkApiSessionId" <> OLD."externalBulkApiSessionId"
     OR NEW."issuedByUserId" <> OLD."issuedByUserId"
     OR NEW."keyHash" <> OLD."keyHash"
     OR NEW."expiresAt" <> OLD."expiresAt"
     OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'External bulk API session authority is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ExternalBulkApiSession_protect" BEFORE UPDATE ON "ExternalBulkApiSession" FOR EACH ROW EXECUTE FUNCTION "ExternalBulkApiSession_protect"();
