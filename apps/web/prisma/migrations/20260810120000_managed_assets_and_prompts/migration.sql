-- CreateTable
CREATE TABLE "ManagedAsset" (
    "managedAssetId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mediaKind" "ManagedAssetMediaKind" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,

    CONSTRAINT "ManagedAsset_pkey" PRIMARY KEY ("managedAssetId")
);

-- CreateTable
CREATE TABLE "AssetPurposeLink" (
    "assetPurposeLinkId" TEXT NOT NULL,
    "managedAssetId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,

    CONSTRAINT "AssetPurposeLink_pkey" PRIMARY KEY ("assetPurposeLinkId")
);

-- CreateTable
CREATE TABLE "PromptRecord" (
    "promptRecordId" TEXT NOT NULL,
    "family" "PromptFamily" NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "PromptStatus" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "PromptRecord_pkey" PRIMARY KEY ("promptRecordId")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "promptVersionId" TEXT NOT NULL,
    "promptRecordId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "promptText" TEXT NOT NULL,
    "responseContract" JSONB NOT NULL,
    "generatedManagedAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("promptVersionId")
);

-- Final sanitized bytes are the sole asset identity authority.
ALTER TABLE "ManagedAsset" ADD CONSTRAINT "ManagedAsset_sha256_check"
CHECK ("sha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "ManagedAsset" ADD CONSTRAINT "ManagedAsset_object_key_check"
CHECK ("objectKey" ~ ('^assets/' || "sha256" || '[.](png|jpg|mp3|mp4)$'));

ALTER TABLE "ManagedAsset" ADD CONSTRAINT "ManagedAsset_byte_size_check"
CHECK ("byteSize" > 0);

-- CreateIndex
CREATE UNIQUE INDEX "ManagedAsset_sha256_key" ON "ManagedAsset"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedAsset_objectKey_key" ON "ManagedAsset"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "AssetPurposeLink_purpose_key" ON "AssetPurposeLink"("purpose");

-- CreateIndex
CREATE INDEX "AssetPurposeLink_managedAssetId_idx" ON "AssetPurposeLink"("managedAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_promptRecordId_version_key" ON "PromptVersion"("promptRecordId", "version");

-- CreateIndex
CREATE INDEX "PromptVersion_generatedManagedAssetId_idx" ON "PromptVersion"("generatedManagedAssetId");

-- CreateIndex
CREATE INDEX "AchievementDefinition_imageAssetId_idx" ON "AchievementDefinition"("imageAssetId");

-- AddForeignKey
ALTER TABLE "AssetPurposeLink" ADD CONSTRAINT "AssetPurposeLink_managedAssetId_fkey" FOREIGN KEY ("managedAssetId") REFERENCES "ManagedAsset"("managedAssetId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_promptRecordId_fkey" FOREIGN KEY ("promptRecordId") REFERENCES "PromptRecord"("promptRecordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_generatedManagedAssetId_fkey" FOREIGN KEY ("generatedManagedAssetId") REFERENCES "ManagedAsset"("managedAssetId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementDefinition" ADD CONSTRAINT "AchievementDefinition_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "ManagedAsset"("managedAssetId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prompt versions are immutable history.
CREATE OR REPLACE FUNCTION reject_prompt_version_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PromptVersion history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PromptVersion_reject_update"
BEFORE UPDATE ON "PromptVersion"
FOR EACH ROW EXECUTE FUNCTION reject_prompt_version_mutation();

CREATE TRIGGER "PromptVersion_reject_delete"
BEFORE DELETE ON "PromptVersion"
FOR EACH ROW EXECUTE FUNCTION reject_prompt_version_mutation();
