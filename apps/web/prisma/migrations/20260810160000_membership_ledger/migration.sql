-- CreateTable
CREATE TABLE "MembershipGrant" (
    "membershipGrantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "MembershipGrantSource" NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "monthsGranted" INTEGER NOT NULL,
    "anchorDay" INTEGER NOT NULL,
    "effectiveStartAt" TIMESTAMP(3) NOT NULL,
    "effectiveEndAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipGrant_pkey" PRIMARY KEY ("membershipGrantId")
);

-- CreateTable
CREATE TABLE "MembershipRevocation" (
    "membershipRevocationId" TEXT NOT NULL,
    "membershipGrantId" TEXT NOT NULL,
    "reason" "MembershipRevocationReason" NOT NULL,
    "refundReference" TEXT NOT NULL,
    "refundedAmountCents" INTEGER NOT NULL,
    "remainingNetAmountCents" INTEGER NOT NULL,
    "monthsAfterRefund" INTEGER NOT NULL,
    "effectiveEndBefore" TIMESTAMP(3) NOT NULL,
    "effectiveEndAfter" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipRevocation_pkey" PRIMARY KEY ("membershipRevocationId")
);

-- CreateTable
CREATE TABLE "Perk" (
    "perkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PerkStatus" NOT NULL,

    CONSTRAINT "Perk_pkey" PRIMARY KEY ("perkId")
);

ALTER TABLE "MembershipGrant" ADD CONSTRAINT "MembershipGrant_window_check"
CHECK (
  "monthsGranted" > 0
  AND "anchorDay" BETWEEN 1 AND 31
  AND "effectiveEndAt" > "effectiveStartAt"
);

ALTER TABLE "MembershipGrant" ADD CONSTRAINT "MembershipGrant_source_amount_check"
CHECK (
  ("source" = 'SUBSCRIPTION' AND "amountCents" = 999 AND "monthsGranted" = 1)
  OR (
    "source" = 'DONATION'
    AND "amountCents" BETWEEN 1000 AND 10000
    AND "monthsGranted" = (
      ("amountCents" / 1000)
      + ("amountCents" / 5000)
      + (3 * ("amountCents" / 10000))
    )
  )
);

ALTER TABLE "MembershipRevocation" ADD CONSTRAINT "MembershipRevocation_values_check"
CHECK (
  "refundedAmountCents" > 0
  AND "remainingNetAmountCents" >= 0
  AND "monthsAfterRefund" >= 0
  AND "effectiveEndAfter" <= "effectiveEndBefore"
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipGrant_source_sourceReference_key" ON "MembershipGrant"("source", "sourceReference");

-- CreateIndex
CREATE INDEX "MembershipGrant_userId_effectiveStartAt_idx" ON "MembershipGrant"("userId", "effectiveStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipRevocation_refundReference_key" ON "MembershipRevocation"("refundReference");

-- CreateIndex
CREATE INDEX "MembershipRevocation_membershipGrantId_revokedAt_idx" ON "MembershipRevocation"("membershipGrantId", "revokedAt");

-- AddForeignKey
ALTER TABLE "MembershipGrant" ADD CONSTRAINT "MembershipGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRevocation" ADD CONSTRAINT "MembershipRevocation_membershipGrantId_fkey" FOREIGN KEY ("membershipGrantId") REFERENCES "MembershipGrant"("membershipGrantId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION validate_membership_revocation()
RETURNS trigger AS $$
DECLARE
  grant_record "MembershipGrant"%ROWTYPE;
  refunded_before INTEGER;
  current_end TIMESTAMP(3);
  expected_remaining INTEGER;
  expected_months INTEGER;
BEGIN
  SELECT * INTO grant_record
  FROM "MembershipGrant"
  WHERE "membershipGrantId" = NEW."membershipGrantId"
  FOR UPDATE;

  IF NOT FOUND OR grant_record."source" <> 'DONATION' THEN
    RAISE EXCEPTION 'Donation refund revocations require a DONATION MembershipGrant';
  END IF;

  SELECT COALESCE(sum("refundedAmountCents"), 0), COALESCE(min("effectiveEndAfter"), grant_record."effectiveEndAt")
  INTO refunded_before, current_end
  FROM "MembershipRevocation"
  WHERE "membershipGrantId" = NEW."membershipGrantId";

  expected_remaining := grant_record."amountCents" - refunded_before - NEW."refundedAmountCents";
  IF expected_remaining < 0 OR NEW."remainingNetAmountCents" <> expected_remaining THEN
    RAISE EXCEPTION 'Donation refund exceeds or conflicts with the remaining net amount';
  END IF;

  IF expected_remaining < 1000 THEN
    expected_months := 0;
  ELSE
    expected_months := (expected_remaining / 1000) + (expected_remaining / 5000) + (3 * (expected_remaining / 10000));
  END IF;

  IF NEW."monthsAfterRefund" <> expected_months THEN
    RAISE EXCEPTION 'Donation refund months do not match the remaining net amount';
  END IF;
  IF NEW."effectiveEndBefore" <> current_end THEN
    RAISE EXCEPTION 'Donation refund does not start from the current entitlement end';
  END IF;
  IF NEW."effectiveEndAfter" < grant_record."effectiveStartAt"
     OR NEW."effectiveEndAfter" < LEAST(NEW."revokedAt", NEW."effectiveEndBefore") THEN
    RAISE EXCEPTION 'Donation refund attempts to revoke consumed entitlement time';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MembershipRevocation_validate"
BEFORE INSERT ON "MembershipRevocation"
FOR EACH ROW EXECUTE FUNCTION validate_membership_revocation();

CREATE OR REPLACE FUNCTION reject_membership_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Membership entitlement ledger is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MembershipGrant_reject_update"
BEFORE UPDATE OR DELETE ON "MembershipGrant"
FOR EACH ROW EXECUTE FUNCTION reject_membership_ledger_mutation();

CREATE TRIGGER "MembershipRevocation_reject_update"
BEFORE UPDATE OR DELETE ON "MembershipRevocation"
FOR EACH ROW EXECUTE FUNCTION reject_membership_ledger_mutation();
