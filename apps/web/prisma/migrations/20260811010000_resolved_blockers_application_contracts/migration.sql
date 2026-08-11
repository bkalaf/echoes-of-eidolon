CREATE TYPE "HelpTicketStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "HelpTicketChannel" AS ENUM ('PLAYER', 'STORE', 'RETURN');
CREATE TYPE "HelpTicketAuthorKind" AS ENUM ('ACCOUNT', 'GUEST', 'SUPPORT');

ALTER TABLE "Order" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingSummary" JSONB;
UPDATE "Order" SET "contactEmail" = "User"."email" FROM "User" WHERE "Order"."userId" = "User"."id";
ALTER TABLE "Order" ALTER COLUMN "contactEmail" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "userId" DROP NOT NULL;
CREATE INDEX "Order_contactEmail_createdAt_idx" ON "Order"("contactEmail", "createdAt");
ALTER TABLE "Site" ADD COLUMN "namingContext" JSONB;

CREATE TABLE "GuardianConsentRecord" (
  "guardianConsentId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "verificationMethod" TEXT NOT NULL,
  CONSTRAINT "GuardianConsentRecord_pkey" PRIMARY KEY ("guardianConsentId")
);
CREATE INDEX "GuardianConsentRecord_accountId_consentedAt_idx" ON "GuardianConsentRecord"("accountId", "consentedAt");
ALTER TABLE "GuardianConsentRecord" ADD CONSTRAINT "GuardianConsentRecord_evidence_check"
CHECK (length(trim("verificationMethod")) > 0 AND ("revokedAt" IS NULL OR "revokedAt" >= "consentedAt"));

CREATE TABLE "MembershipSubscription" (
  "membershipSubscriptionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stripeCheckoutReference" TEXT,
  "stripeCustomerReference" TEXT,
  "stripeSubscriptionReference" TEXT,
  "providerStatus" TEXT NOT NULL,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "currentPeriodStartAt" TIMESTAMP(3),
  "currentPeriodEndAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MembershipSubscription_pkey" PRIMARY KEY ("membershipSubscriptionId")
);
CREATE UNIQUE INDEX "MembershipSubscription_stripeCheckoutReference_key" ON "MembershipSubscription"("stripeCheckoutReference");
CREATE UNIQUE INDEX "MembershipSubscription_stripeSubscriptionReference_key" ON "MembershipSubscription"("stripeSubscriptionReference");
CREATE INDEX "MembershipSubscription_userId_updatedAt_idx" ON "MembershipSubscription"("userId", "updatedAt");
CREATE INDEX "MembershipSubscription_stripeCustomerReference_idx" ON "MembershipSubscription"("stripeCustomerReference");
ALTER TABLE "MembershipSubscription" ADD CONSTRAINT "MembershipSubscription_period_check"
CHECK ("currentPeriodEndAt" IS NULL OR "currentPeriodStartAt" IS NULL OR "currentPeriodEndAt" > "currentPeriodStartAt");

CREATE TABLE "MembershipSubscriptionEvent" (
  "membershipSubscriptionEventId" TEXT NOT NULL,
  "membershipSubscriptionId" TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerStatus" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "currentPeriodStartAt" TIMESTAMP(3),
  "currentPeriodEndAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MembershipSubscriptionEvent_pkey" PRIMARY KEY ("membershipSubscriptionEventId")
);
CREATE UNIQUE INDEX "MembershipSubscriptionEvent_stripeEventId_key" ON "MembershipSubscriptionEvent"("stripeEventId");
CREATE INDEX "MembershipSubscriptionEvent_membershipSubscriptionId_occurr_idx" ON "MembershipSubscriptionEvent"("membershipSubscriptionId", "occurredAt");

CREATE TABLE "HelpTicket" (
  "helpTicketId" TEXT NOT NULL,
  "userId" TEXT,
  "contactEmail" TEXT NOT NULL,
  "orderId" TEXT,
  "channel" "HelpTicketChannel" NOT NULL,
  "categoryKey" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "HelpTicketStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HelpTicket_pkey" PRIMARY KEY ("helpTicketId")
);
CREATE INDEX "HelpTicket_userId_status_updatedAt_idx" ON "HelpTicket"("userId", "status", "updatedAt");
CREATE INDEX "HelpTicket_contactEmail_status_updatedAt_idx" ON "HelpTicket"("contactEmail", "status", "updatedAt");
CREATE INDEX "HelpTicket_orderId_idx" ON "HelpTicket"("orderId");
ALTER TABLE "HelpTicket" ADD CONSTRAINT "HelpTicket_text_check"
CHECK (length(trim("categoryKey")) > 0 AND length(trim("subject")) BETWEEN 1 AND 200);

CREATE TABLE "HelpTicketMessage" (
  "helpTicketMessageId" TEXT NOT NULL,
  "helpTicketId" TEXT NOT NULL,
  "authorUserId" TEXT,
  "authorKind" "HelpTicketAuthorKind" NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HelpTicketMessage_pkey" PRIMARY KEY ("helpTicketMessageId")
);
CREATE INDEX "HelpTicketMessage_helpTicketId_createdAt_idx" ON "HelpTicketMessage"("helpTicketId", "createdAt");
ALTER TABLE "HelpTicketMessage" ADD CONSTRAINT "HelpTicketMessage_text_check" CHECK (length(trim("message")) BETWEEN 1 AND 10000);
ALTER TABLE "HelpTicketMessage" ADD CONSTRAINT "HelpTicketMessage_author_check"
CHECK (("authorKind" = 'ACCOUNT' AND "authorUserId" IS NOT NULL) OR ("authorKind" IN ('GUEST', 'SUPPORT') AND "authorUserId" IS NULL));

CREATE TABLE "HelpTicketAttachment" (
  "helpTicketAttachmentId" TEXT NOT NULL,
  "helpTicketMessageId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HelpTicketAttachment_pkey" PRIMARY KEY ("helpTicketAttachmentId")
);
CREATE INDEX "HelpTicketAttachment_helpTicketMessageId_idx" ON "HelpTicketAttachment"("helpTicketMessageId");
ALTER TABLE "HelpTicketAttachment" ADD CONSTRAINT "HelpTicketAttachment_bounds_check"
CHECK ("byteSize" BETWEEN 1 AND 5242880 AND "sha256" ~ '^[0-9a-f]{64}$' AND "mimeType" IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'));

CREATE TABLE "OrderReturnRequest" (
  "orderReturnRequestId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "helpTicketId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderReturnRequest_pkey" PRIMARY KEY ("orderReturnRequestId")
);
CREATE UNIQUE INDEX "OrderReturnRequest_orderId_key" ON "OrderReturnRequest"("orderId");
CREATE UNIQUE INDEX "OrderReturnRequest_helpTicketId_key" ON "OrderReturnRequest"("helpTicketId");

CREATE TABLE "OrderPublicAccessToken" (
  "orderPublicAccessTokenId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "emailHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderPublicAccessToken_pkey" PRIMARY KEY ("orderPublicAccessTokenId")
);
CREATE UNIQUE INDEX "OrderPublicAccessToken_tokenHash_key" ON "OrderPublicAccessToken"("tokenHash");
CREATE INDEX "OrderPublicAccessToken_orderId_createdAt_idx" ON "OrderPublicAccessToken"("orderId", "createdAt");
ALTER TABLE "OrderPublicAccessToken" ADD CONSTRAINT "OrderPublicAccessToken_hash_check"
CHECK ("tokenHash" ~ '^[0-9a-f]{64}$' AND "emailHash" ~ '^[0-9a-f]{64}$' AND "expiresAt" > "createdAt");

CREATE TABLE "PromptTextResult" (
  "promptTextResultId" TEXT NOT NULL,
  "promptVersionId" TEXT NOT NULL,
  "rawResponse" TEXT NOT NULL,
  "parsedResponse" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3),
  CONSTRAINT "PromptTextResult_pkey" PRIMARY KEY ("promptTextResultId")
);
CREATE INDEX "PromptTextResult_promptVersionId_createdAt_idx" ON "PromptTextResult"("promptVersionId", "createdAt");

CREATE TABLE "AtlasNameableFeature" (
  "featureId" TEXT NOT NULL,
  "featureType" TEXT NOT NULL,
  "name" TEXT,
  "context" JSONB NOT NULL,
  CONSTRAINT "AtlasNameableFeature_pkey" PRIMARY KEY ("featureId")
);

CREATE TABLE "AtlasNamingEligibility" (
  "siteId" TEXT NOT NULL,
  "featureId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "distanceKm" DOUBLE PRECISION,
  CONSTRAINT "AtlasNamingEligibility_pkey" PRIMARY KEY ("siteId", "featureId")
);
CREATE UNIQUE INDEX "AtlasNamingEligibility_featureId_rank_key" ON "AtlasNamingEligibility"("featureId", "rank");
CREATE INDEX "AtlasNamingEligibility_siteId_rank_idx" ON "AtlasNamingEligibility"("siteId", "rank");
ALTER TABLE "AtlasNamingEligibility" ADD CONSTRAINT "AtlasNamingEligibility_rank_check" CHECK ("rank" BETWEEN 1 AND 5 AND ("distanceKm" IS NULL OR "distanceKm" >= 0));

ALTER TABLE "GuardianConsentRecord" ADD CONSTRAINT "GuardianConsentRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipSubscription" ADD CONSTRAINT "MembershipSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipSubscriptionEvent" ADD CONSTRAINT "MembershipSubscriptionEvent_membershipSubscriptionId_fkey" FOREIGN KEY ("membershipSubscriptionId") REFERENCES "MembershipSubscription"("membershipSubscriptionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HelpTicket" ADD CONSTRAINT "HelpTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HelpTicket" ADD CONSTRAINT "HelpTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HelpTicketMessage" ADD CONSTRAINT "HelpTicketMessage_helpTicketId_fkey" FOREIGN KEY ("helpTicketId") REFERENCES "HelpTicket"("helpTicketId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HelpTicketMessage" ADD CONSTRAINT "HelpTicketMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HelpTicketAttachment" ADD CONSTRAINT "HelpTicketAttachment_helpTicketMessageId_fkey" FOREIGN KEY ("helpTicketMessageId") REFERENCES "HelpTicketMessage"("helpTicketMessageId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderReturnRequest" ADD CONSTRAINT "OrderReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderReturnRequest" ADD CONSTRAINT "OrderReturnRequest_helpTicketId_fkey" FOREIGN KEY ("helpTicketId") REFERENCES "HelpTicket"("helpTicketId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderPublicAccessToken" ADD CONSTRAINT "OrderPublicAccessToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptTextResult" ADD CONSTRAINT "PromptTextResult_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("promptVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AtlasNamingEligibility" ADD CONSTRAINT "AtlasNamingEligibility_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("siteId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtlasNamingEligibility" ADD CONSTRAINT "AtlasNamingEligibility_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "AtlasNameableFeature"("featureId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_subscription_event_mutation()
RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Subscription provider event history is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "MembershipSubscriptionEvent_reject_update" BEFORE UPDATE OR DELETE ON "MembershipSubscriptionEvent" FOR EACH ROW EXECUTE FUNCTION reject_subscription_event_mutation();

CREATE OR REPLACE FUNCTION reject_prompt_text_result_mutation()
RETURNS trigger AS $$ BEGIN
  IF TG_OP = 'DELETE' OR OLD."rawResponse" <> NEW."rawResponse" OR OLD."parsedResponse" <> NEW."parsedResponse" OR OLD."promptVersionId" <> NEW."promptVersionId" THEN
    RAISE EXCEPTION 'Prompt text result provenance is immutable';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PromptTextResult_preserve_provenance" BEFORE UPDATE OR DELETE ON "PromptTextResult" FOR EACH ROW EXECUTE FUNCTION reject_prompt_text_result_mutation();
