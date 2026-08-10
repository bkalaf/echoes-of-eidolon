ALTER TYPE "AccountEligibilityStatus"
  RENAME VALUE 'AGE_18_OR_OLDER' TO 'ADULT_18_PLUS';

ALTER TYPE "AccountEligibilityStatus"
  RENAME VALUE 'AGE_14_TO_17_WITH_GUARDIAN_PERMISSION' TO 'MINOR_14_17_GUARDIAN_CONSENTED';

CREATE TYPE "BetaInviteRequestStatus" AS ENUM ('PENDING', 'INVITED', 'REJECTED');

ALTER TABLE "User"
  ADD COLUMN "betaEligible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TwoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BetaInviteRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "friendName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BetaInviteRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BetaInviteRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BetaInvitationCode" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "consumedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BetaInvitationCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TwoFactor_secret_idx" ON "TwoFactor"("secret");
CREATE INDEX "TwoFactor_userId_idx" ON "TwoFactor"("userId");
CREATE INDEX "BetaInviteRequest_requesterId_idx" ON "BetaInviteRequest"("requesterId");
CREATE INDEX "BetaInviteRequest_status_idx" ON "BetaInviteRequest"("status");
CREATE UNIQUE INDEX "BetaInvitationCode_requestId_key" ON "BetaInvitationCode"("requestId");
CREATE UNIQUE INDEX "BetaInvitationCode_codeHash_key" ON "BetaInvitationCode"("codeHash");
CREATE INDEX "BetaInvitationCode_recipientEmail_idx" ON "BetaInvitationCode"("recipientEmail");
CREATE INDEX "BetaInvitationCode_expiresAt_idx" ON "BetaInvitationCode"("expiresAt");
CREATE INDEX "BetaInvitationCode_consumedByUserId_idx" ON "BetaInvitationCode"("consumedByUserId");

ALTER TABLE "TwoFactor" ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BetaInviteRequest" ADD CONSTRAINT "BetaInviteRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BetaInvitationCode" ADD CONSTRAINT "BetaInvitationCode_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BetaInviteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BetaInvitationCode" ADD CONSTRAINT "BetaInvitationCode_consumedByUserId_fkey" FOREIGN KEY ("consumedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
