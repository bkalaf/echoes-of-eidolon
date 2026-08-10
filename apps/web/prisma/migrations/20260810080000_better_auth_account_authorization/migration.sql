CREATE TYPE "AuthorizationRole" AS ENUM ('user', 'member', 'admin', 'owner');

ALTER TABLE "User"
  ADD COLUMN "role" "AuthorizationRole" NOT NULL DEFAULT 'user',
  ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "banReason" TEXT,
  ADD COLUMN "banExpires" TIMESTAMP(3);

ALTER TABLE "Session"
  ADD COLUMN "impersonatedBy" TEXT;
