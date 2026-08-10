-- The reviewed account contract exposes an immutable username and display form.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "displayUsername" TEXT;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
