-- DropIndex
DROP INDEX "Settlement_regionId_idx";

-- DropIndex
DROP INDEX "Site_settlementId_idx";

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Settlement" settlement
    LEFT JOIN "Site" site ON site."siteId" = settlement."siteId"
    WHERE site."siteId" IS NULL OR settlement."regionId" <> site."regionId"
  ) THEN
    RAISE EXCEPTION 'Settlement region does not match its authoritative Site';
  END IF;
END $$;

ALTER TABLE "Settlement" DROP COLUMN "regionId";
ALTER TABLE "Settlement" RENAME COLUMN "size" TO "classification";
ALTER TABLE "Settlement"
ALTER COLUMN "classification" TYPE "SettlementClassification"
USING ("classification"::text::"SettlementClassification"),
ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Site" site
    LEFT JOIN "Settlement" settlement
      ON settlement."settlementId" = site."settlementId"
      AND settlement."siteId" = site."siteId"
    WHERE site."settlementId" IS NOT NULL AND settlement."settlementId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Site settlement link conflicts with Settlement.siteId authority';
  END IF;
END $$;

ALTER TABLE "Site" DROP COLUMN "settlementId";
ALTER TABLE "Site"
ALTER COLUMN "regionId" TYPE "RegionId"
USING ("regionId"::text::"RegionId"),
ALTER COLUMN "candidateType" TYPE "SettlementClassification"
USING ("candidateType"::text::"SettlementClassification");

-- DropTable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "BreedPopulation") THEN
    RAISE EXCEPTION 'BreedPopulation contains rows and requires an explicitly approved event migration';
  END IF;
END $$;

DROP TABLE "BreedPopulation";

-- CreateTable
CREATE TABLE "SettlementWorld" (
    "settlementWorldId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "worldKey" "WorldKey" NOT NULL,
    "totalPopulation" INTEGER NOT NULL DEFAULT 0,
    "dominantBreedId" TEXT,
    "cultureId" TEXT,

    CONSTRAINT "SettlementWorld_pkey" PRIMARY KEY ("settlementWorldId")
);

-- CreateTable
CREATE TABLE "SettlementPopulationEvent" (
    "settlementPopulationEventId" TEXT NOT NULL,
    "settlementWorldId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "breedId" TEXT NOT NULL,
    "eventType" "SettlementPopulationEventType" NOT NULL,
    "populationDelta" INTEGER NOT NULL,

    CONSTRAINT "SettlementPopulationEvent_pkey" PRIMARY KEY ("settlementPopulationEventId")
);

-- CreateIndex
CREATE INDEX "SettlementWorld_dominantBreedId_idx" ON "SettlementWorld"("dominantBreedId");

-- CreateIndex
CREATE INDEX "SettlementWorld_cultureId_idx" ON "SettlementWorld"("cultureId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementWorld_settlementId_worldKey_key" ON "SettlementWorld"("settlementId", "worldKey");

-- CreateIndex
CREATE INDEX "SettlementPopulationEvent_breedId_idx" ON "SettlementPopulationEvent"("breedId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementPopulationEvent_settlementWorldId_year_sequence_key" ON "SettlementPopulationEvent"("settlementWorldId", "year", "sequence");

-- Population history is append-only. Updates/deletes require a future explicit,
-- audited correction mechanism rather than silently rewriting authority.
CREATE OR REPLACE FUNCTION reject_settlement_population_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'SettlementPopulationEvent history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SettlementPopulationEvent_reject_update"
BEFORE UPDATE ON "SettlementPopulationEvent"
FOR EACH ROW EXECUTE FUNCTION reject_settlement_population_event_mutation();

CREATE TRIGGER "SettlementPopulationEvent_reject_delete"
BEFORE DELETE ON "SettlementPopulationEvent"
FOR EACH ROW EXECUTE FUNCTION reject_settlement_population_event_mutation();

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_siteId_key" ON "Settlement"("siteId");

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("siteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementWorld" ADD CONSTRAINT "SettlementWorld_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("settlementId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementWorld" ADD CONSTRAINT "SettlementWorld_dominantBreedId_fkey" FOREIGN KEY ("dominantBreedId") REFERENCES "Breed"("breedId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementWorld" ADD CONSTRAINT "SettlementWorld_cultureId_fkey" FOREIGN KEY ("cultureId") REFERENCES "Culture"("cultureId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPopulationEvent" ADD CONSTRAINT "SettlementPopulationEvent_settlementWorldId_fkey" FOREIGN KEY ("settlementWorldId") REFERENCES "SettlementWorld"("settlementWorldId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPopulationEvent" ADD CONSTRAINT "SettlementPopulationEvent_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("breedId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SettlementWorld" ADD CONSTRAINT "SettlementWorld_totalPopulation_nonnegative_check"
CHECK ("totalPopulation" >= 0);

ALTER TABLE "SettlementPopulationEvent" ADD CONSTRAINT "SettlementPopulationEvent_year_check"
CHECK ("year" BETWEEN 0 AND 4040);
