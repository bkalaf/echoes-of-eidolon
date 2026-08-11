CREATE TYPE "ContactTopic" AS ENUM ('ACCESSIBILITY', 'CULTURAL_RESEARCH', 'GENERAL', 'LEGAL', 'PARTNERSHIP', 'PRESS', 'PRIVACY', 'SECURITY');
CREATE TYPE "ContactRequestStatus" AS ENUM ('RECEIVED', 'DELIVERY_PENDING', 'DELIVERED', 'DELIVERY_FAILED');
CREATE TYPE "GameTurnStatus" AS ENUM ('RECEIVED', 'PROVIDER_PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "DocumentDraftStatus" AS ENUM ('DRAFT', 'REVIEWED', 'PUBLISHED');
CREATE TYPE "DeploymentStatus" AS ENUM ('PLANNED', 'DEPLOYING', 'HEALTHY', 'FAILED', 'ROLLED_BACK');
CREATE TYPE "CampaignObjectType" AS ENUM ('PILLAR', 'LESSON', 'IN_TRANSIT', 'EXODUS', 'TRANSITION', 'DEJA_VU', 'COMPANION', 'ATROCITY', 'WITNESS', 'ARCHITECT', 'LEGENDARY_REWARD', 'HOLIDAY', 'WWII_INTERLUDE', 'MYTH_INTERLUDE', 'SCIENCE_INTERLUDE', 'HISTORICAL_INTERLUDE');
CREATE TYPE "DonationCheckoutStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'FAILED');

CREATE TABLE "ContactRequest" (
  "contactRequestId" TEXT NOT NULL,
  "topic" "ContactTopic" NOT NULL,
  "replyEmail" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "ContactRequestStatus" NOT NULL DEFAULT 'RECEIVED',
  "providerReference" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("contactRequestId")
);
CREATE INDEX "ContactRequest_topic_createdAt_idx" ON "ContactRequest"("topic", "createdAt");
CREATE INDEX "ContactRequest_status_createdAt_idx" ON "ContactRequest"("status", "createdAt");

CREATE TABLE "DonationCheckout" (
  "donationCheckoutId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stripeCheckoutReference" TEXT,
  "amountCents" INTEGER NOT NULL,
  "monthsGranted" INTEGER NOT NULL,
  "status" "DonationCheckoutStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  CONSTRAINT "DonationCheckout_pkey" PRIMARY KEY ("donationCheckoutId")
);
CREATE UNIQUE INDEX "DonationCheckout_stripeCheckoutReference_key" ON "DonationCheckout"("stripeCheckoutReference");
CREATE INDEX "DonationCheckout_userId_createdAt_idx" ON "DonationCheckout"("userId", "createdAt");
ALTER TABLE "DonationCheckout" ADD CONSTRAINT "DonationCheckout_amount_check" CHECK ("amountCents" BETWEEN 1000 AND 10000 AND "monthsGranted" > 0);

CREATE TABLE "Release" (
  "releaseId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "gitSha" TEXT NOT NULL,
  "status" "ReleaseNotesStatus" NOT NULL DEFAULT 'DRAFT',
  "audience" "ReleaseAudience" NOT NULL,
  "summary" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "Release_pkey" PRIMARY KEY ("releaseId")
);
CREATE UNIQUE INDEX "Release_gitSha_key" ON "Release"("gitSha");
CREATE UNIQUE INDEX "Release_version_audience_key" ON "Release"("version", "audience");
CREATE INDEX "Release_status_publishedAt_idx" ON "Release"("status", "publishedAt");
ALTER TABLE "Release" ADD CONSTRAINT "Release_git_sha_check" CHECK ("gitSha" ~ '^[0-9a-f]{40}$');
ALTER TABLE "Release" ADD CONSTRAINT "Release_publication_check" CHECK (
  ("status" = 'DRAFT' AND "publishedAt" IS NULL) OR
  ("status" IN ('PUBLISHED', 'SUPERSEDED') AND "publishedAt" IS NOT NULL)
);

CREATE TABLE "ReleaseNoteItem" (
  "releaseNoteItemId" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "category" "ReleaseNoteCategory" NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  CONSTRAINT "ReleaseNoteItem_pkey" PRIMARY KEY ("releaseNoteItemId")
);
CREATE UNIQUE INDEX "ReleaseNoteItem_releaseId_category_ordinal_key" ON "ReleaseNoteItem"("releaseId", "category", "ordinal");

CREATE TABLE "DeploymentRecord" (
  "deploymentRecordId" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "gitSha" TEXT NOT NULL,
  "status" "DeploymentStatus" NOT NULL,
  "productionUrl" TEXT NOT NULL,
  "backupIdentifier" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "DeploymentRecord_pkey" PRIMARY KEY ("deploymentRecordId")
);
CREATE INDEX "DeploymentRecord_gitSha_status_idx" ON "DeploymentRecord"("gitSha", "status");
ALTER TABLE "DeploymentRecord" ADD CONSTRAINT "DeploymentRecord_git_sha_check" CHECK ("gitSha" ~ '^[0-9a-f]{40}$');

CREATE TABLE "DocumentBucket" (
  "documentBucketId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "DocumentBucket_pkey" PRIMARY KEY ("documentBucketId")
);
CREATE TABLE "DocumentSourcePoint" (
  "documentSourcePointId" TEXT NOT NULL,
  "documentBucketId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "sourceLabel" TEXT NOT NULL,
  CONSTRAINT "DocumentSourcePoint_pkey" PRIMARY KEY ("documentSourcePointId")
);
CREATE UNIQUE INDEX "DocumentSourcePoint_documentBucketId_ordinal_key" ON "DocumentSourcePoint"("documentBucketId", "ordinal");
CREATE TABLE "DocumentAmendment" (
  "documentAmendmentId" TEXT NOT NULL,
  "documentBucketId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  CONSTRAINT "DocumentAmendment_pkey" PRIMARY KEY ("documentAmendmentId")
);
CREATE UNIQUE INDEX "DocumentAmendment_documentBucketId_ordinal_key" ON "DocumentAmendment"("documentBucketId", "ordinal");
CREATE TABLE "DocumentDraft" (
  "documentDraftId" TEXT NOT NULL,
  "documentBucketId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "DocumentDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "content" TEXT NOT NULL,
  "sourcePointIds" TEXT[] NOT NULL,
  "amendmentIds" TEXT[] NOT NULL,
  "authoredByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentDraft_pkey" PRIMARY KEY ("documentDraftId")
);
CREATE UNIQUE INDEX "DocumentDraft_documentBucketId_version_key" ON "DocumentDraft"("documentBucketId", "version");
CREATE INDEX "DocumentDraft_authoredByUserId_idx" ON "DocumentDraft"("authoredByUserId");

CREATE TABLE "GameSession" (
  "gameSessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "settlementWorldId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActiveAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameSession_pkey" PRIMARY KEY ("gameSessionId")
);
CREATE INDEX "GameSession_userId_lastActiveAt_idx" ON "GameSession"("userId", "lastActiveAt");
CREATE INDEX "GameSession_settlementWorldId_idx" ON "GameSession"("settlementWorldId");
CREATE TABLE "GameTurn" (
  "gameTurnId" TEXT NOT NULL,
  "gameSessionId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "inputText" TEXT NOT NULL,
  "responseText" TEXT,
  "status" "GameTurnStatus" NOT NULL DEFAULT 'RECEIVED',
  "providerReference" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "GameTurn_pkey" PRIMARY KEY ("gameTurnId")
);
CREATE UNIQUE INDEX "GameTurn_gameSessionId_sequence_key" ON "GameTurn"("gameSessionId", "sequence");

CREATE TABLE "City" (
  "cityId" TEXT NOT NULL,
  "settlementWorldId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "geometryVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "City_pkey" PRIMARY KEY ("cityId")
);
CREATE UNIQUE INDEX "City_settlementWorldId_key" ON "City"("settlementWorldId");
CREATE TABLE "Parcel" (
  "parcelId" TEXT NOT NULL,
  "cityId" TEXT NOT NULL,
  "geometry" JSONB NOT NULL,
  CONSTRAINT "Parcel_pkey" PRIMARY KEY ("parcelId")
);
CREATE INDEX "Parcel_cityId_idx" ON "Parcel"("cityId");
CREATE TABLE "Street" (
  "streetId" TEXT NOT NULL,
  "cityId" TEXT NOT NULL,
  "geometry" JSONB NOT NULL,
  CONSTRAINT "Street_pkey" PRIMARY KEY ("streetId")
);
CREATE INDEX "Street_cityId_idx" ON "Street"("cityId");
CREATE TABLE "Building" (
  "buildingId" TEXT NOT NULL,
  "cityId" TEXT NOT NULL,
  "parcelId" TEXT,
  "geometry" JSONB NOT NULL,
  CONSTRAINT "Building_pkey" PRIMARY KEY ("buildingId")
);
CREATE INDEX "Building_cityId_idx" ON "Building"("cityId");

CREATE TABLE "Campaign" (
  "campaignId" TEXT NOT NULL,
  "worldKey" "WorldKey" NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("campaignId")
);
CREATE TABLE "CampaignPlacement" (
  "campaignPlacementId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "objectType" "CampaignObjectType" NOT NULL,
  "objectId" TEXT NOT NULL,
  "bookNumbers" INTEGER[] NOT NULL,
  "ordinal" INTEGER NOT NULL,
  CONSTRAINT "CampaignPlacement_pkey" PRIMARY KEY ("campaignPlacementId")
);
CREATE UNIQUE INDEX "Campaign_worldKey_key" ON "Campaign"("worldKey");
CREATE UNIQUE INDEX "CampaignPlacement_campaignId_objectType_objectId_key" ON "CampaignPlacement"("campaignId", "objectType", "objectId");
CREATE UNIQUE INDEX "CampaignPlacement_campaignId_ordinal_key" ON "CampaignPlacement"("campaignId", "ordinal");
ALTER TABLE "CampaignPlacement" ADD CONSTRAINT "CampaignPlacement_books_check" CHECK (cardinality("bookNumbers") > 0 AND "bookNumbers" <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]);

CREATE TABLE "CalendarOrdinal" (
  "calendarOrdinalId" TEXT NOT NULL,
  "ordinalDay" INTEGER NOT NULL,
  "monthNumber" INTEGER NOT NULL,
  "dayOfMonth" INTEGER NOT NULL,
  "weekdayName" TEXT NOT NULL,
  "monthName" TEXT NOT NULL,
  CONSTRAINT "CalendarOrdinal_pkey" PRIMARY KEY ("calendarOrdinalId")
);
CREATE UNIQUE INDEX "CalendarOrdinal_ordinalDay_key" ON "CalendarOrdinal"("ordinalDay");
ALTER TABLE "CalendarOrdinal" ADD CONSTRAINT "CalendarOrdinal_range_check" CHECK ("ordinalDay" BETWEEN 1 AND 489 AND "monthNumber" BETWEEN 1 AND 18 AND "dayOfMonth" BETWEEN 1 AND 27);

ALTER TABLE "ReleaseNoteItem" ADD CONSTRAINT "ReleaseNoteItem_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("releaseId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DonationCheckout" ADD CONSTRAINT "DonationCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeploymentRecord" ADD CONSTRAINT "DeploymentRecord_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("releaseId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentSourcePoint" ADD CONSTRAINT "DocumentSourcePoint_documentBucketId_fkey" FOREIGN KEY ("documentBucketId") REFERENCES "DocumentBucket"("documentBucketId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAmendment" ADD CONSTRAINT "DocumentAmendment_documentBucketId_fkey" FOREIGN KEY ("documentBucketId") REFERENCES "DocumentBucket"("documentBucketId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentDraft" ADD CONSTRAINT "DocumentDraft_documentBucketId_fkey" FOREIGN KEY ("documentBucketId") REFERENCES "DocumentBucket"("documentBucketId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentDraft" ADD CONSTRAINT "DocumentDraft_authoredByUserId_fkey" FOREIGN KEY ("authoredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_settlementWorldId_fkey" FOREIGN KEY ("settlementWorldId") REFERENCES "SettlementWorld"("settlementWorldId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameTurn" ADD CONSTRAINT "GameTurn_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("gameSessionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "City" ADD CONSTRAINT "City_settlementWorldId_fkey" FOREIGN KEY ("settlementWorldId") REFERENCES "SettlementWorld"("settlementWorldId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("cityId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Street" ADD CONSTRAINT "Street_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("cityId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Building" ADD CONSTRAINT "Building_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("cityId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignPlacement" ADD CONSTRAINT "CampaignPlacement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("campaignId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_versioned_document_mutation()
RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'DocumentDraft versions are immutable'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "DocumentDraft_reject_update" BEFORE UPDATE OR DELETE ON "DocumentDraft" FOR EACH ROW EXECUTE FUNCTION reject_versioned_document_mutation();
