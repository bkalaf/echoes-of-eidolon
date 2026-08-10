-- Store only the reviewed eligibility status; never date of birth or numeric age.
CREATE TYPE "AccountEligibilityStatus" AS ENUM (
  'AGE_18_OR_OLDER',
  'AGE_14_TO_17_WITH_GUARDIAN_PERMISSION'
);

ALTER TABLE "User"
  ADD COLUMN "eligibilityStatus" "AccountEligibilityStatus" NOT NULL;
