DROP INDEX IF EXISTS "Soundtrack_managedAssetId_key";
CREATE INDEX IF NOT EXISTS "Soundtrack_managedAssetId_idx" ON "Soundtrack"("managedAssetId");
