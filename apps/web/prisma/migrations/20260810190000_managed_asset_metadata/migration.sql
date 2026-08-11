ALTER TABLE "ManagedAsset"
ADD COLUMN "technicalMetadata" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "ManagedAsset"
ALTER COLUMN "technicalMetadata" DROP DEFAULT;
