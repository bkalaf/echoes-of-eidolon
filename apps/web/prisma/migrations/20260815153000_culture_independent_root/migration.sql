-- Culture is an independent canonical root. CulturePool remains a separate
-- compact registry used by Matrix and does not gate Culture persistence.
ALTER TABLE "Culture" DROP COLUMN "culturePoolId";
