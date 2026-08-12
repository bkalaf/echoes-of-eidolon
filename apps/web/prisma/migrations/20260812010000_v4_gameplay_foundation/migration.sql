ALTER TYPE "CompanionKey" ADD VALUE IF NOT EXISTS 'L';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'ITEM';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'OCCUPATION';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'PARTY';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'SOUNDTRACK';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'WORLD_INSTANCE';

CREATE TYPE "AbilityType" AS ENUM ('CHARISMA', 'DEXTERITY', 'INTELLIGENCE', 'STAMINA', 'STRENGTH', 'WISDOM');
CREATE TYPE "KnowledgeSkill" AS ENUM ('EIDETIC_MEMORY', 'PHOTOGRAPHIC_MEMORY', 'RECOGNITION', 'ORIENTATION', 'RESEARCH', 'ORIGINS', 'LORE', 'GOSSIP', 'PERFECT_PITCH', 'CONNECTIONS', 'TRACE');
CREATE TYPE "AwarenessSkill" AS ENUM ('DANGER_SENSE', 'TRAP_SENSE', 'POISON_SENSE', 'DIPLOMACY', 'DECEPTION_SENSE', 'READ_BETWEEN_THE_LINES', 'EMPATHY', 'STREETWISE', 'GUARDIAN', 'FIRST_AID', 'RESOLVE');
CREATE TYPE "PointOfInterestService" AS ENUM ('BANK', 'INN');
CREATE TYPE "SoundtrackCategory" AS ENUM ('CITY', 'TAVERN');

ALTER TABLE "Soul" ADD COLUMN "companionKey" "CompanionKey";
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Companion" GROUP BY "soulId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Soul companion keys require an unambiguous authored Companion relationship';
  END IF;
END $$;
UPDATE "Soul" SET "companionKey" = "Companion"."companionKey"
FROM "Companion" WHERE "Companion"."soulId" = "Soul"."soulId" AND "Soul"."companionKey" IS NULL;

ALTER TABLE "UserSettings"
  ADD COLUMN "audioMasterVolume" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "audioSoundtrackVolume" INTEGER NOT NULL DEFAULT 70,
  ADD COLUMN "audioNarrativeVolume" INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN "audioMuted" BOOLEAN NOT NULL DEFAULT false;
UPDATE "UserSettings" SET
  "audioSoundtrackVolume" = "musicVolume",
  "audioNarrativeVolume" = "soundVolume",
  "audioMuted" = NOT ("musicEnabled" OR "soundEnabled");
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_audio_volume_check"
CHECK ("audioMasterVolume" BETWEEN 0 AND 100 AND "audioSoundtrackVolume" BETWEEN 0 AND 100 AND "audioNarrativeVolume" BETWEEN 0 AND 100);

CREATE TABLE "Occupation" (
  "occupationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Occupation_pkey" PRIMARY KEY ("occupationId")
);
CREATE UNIQUE INDEX "Occupation_name_key" ON "Occupation"("name");
ALTER TABLE "Occupation" ADD CONSTRAINT "Occupation_name_check" CHECK (length(trim("name")) > 0);

CREATE TABLE "OccupationAttributeAffinity" (
  "occupationId" TEXT NOT NULL,
  "abilityType" "AbilityType" NOT NULL,
  "ordinal" INTEGER NOT NULL,
  CONSTRAINT "OccupationAttributeAffinity_pkey" PRIMARY KEY ("occupationId", "abilityType")
);
CREATE UNIQUE INDEX "OccupationAttributeAffinity_occupationId_ordinal_key" ON "OccupationAttributeAffinity"("occupationId", "ordinal");
ALTER TABLE "OccupationAttributeAffinity" ADD CONSTRAINT "OccupationAttributeAffinity_ordinal_check" CHECK ("ordinal" >= 0);
ALTER TABLE "OccupationAttributeAffinity" ADD CONSTRAINT "OccupationAttributeAffinity_occupationId_fkey" FOREIGN KEY ("occupationId") REFERENCES "Occupation"("occupationId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CompanionTransformationBinding" (
  "companionKey" "CompanionKey" NOT NULL,
  "layetteId" TEXT NOT NULL,
  "capabilityDefinitionId" TEXT NOT NULL,
  CONSTRAINT "CompanionTransformationBinding_pkey" PRIMARY KEY ("companionKey")
);
CREATE INDEX "CompanionTransformationBinding_layetteId_idx" ON "CompanionTransformationBinding"("layetteId");
CREATE INDEX "CompanionTransformationBinding_capabilityDefinitionId_idx" ON "CompanionTransformationBinding"("capabilityDefinitionId");
ALTER TABLE "CompanionTransformationBinding" ADD CONSTRAINT "CompanionTransformationBinding_companionKey_fkey" FOREIGN KEY ("companionKey") REFERENCES "Companion"("companionKey") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanionTransformationBinding" ADD CONSTRAINT "CompanionTransformationBinding_layetteId_fkey" FOREIGN KEY ("layetteId") REFERENCES "Layette"("layetteId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanionTransformationBinding" ADD CONSTRAINT "CompanionTransformationBinding_capabilityDefinitionId_fkey" FOREIGN KEY ("capabilityDefinitionId") REFERENCES "CapabilityDefinition"("capabilityDefinitionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Protagonist"
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "age" INTEGER,
  ADD COLUMN "occupationId" TEXT,
  ADD COLUMN "knowledgeSkill" "KnowledgeSkill",
  ADD COLUMN "awarenessSkill" "AwarenessSkill",
  ADD COLUMN "faction" "Faction",
  ADD COLUMN "primaryAttribute" "AbilityType",
  ADD COLUMN "secondaryAttribute" "AbilityType",
  ADD COLUMN "worldHeirloom" "Heirloom";
CREATE INDEX "Protagonist_occupationId_idx" ON "Protagonist"("occupationId");
ALTER TABLE "Protagonist" ADD CONSTRAINT "Protagonist_age_check" CHECK ("age" IS NULL OR "age" >= 0);
ALTER TABLE "Protagonist" ADD CONSTRAINT "Protagonist_occupationId_fkey" FOREIGN KEY ("occupationId") REFERENCES "Occupation"("occupationId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PointOfInterestServiceAssignment" (
  "pointOfInterestId" TEXT NOT NULL,
  "service" "PointOfInterestService" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "configuration" JSONB,
  CONSTRAINT "PointOfInterestServiceAssignment_pkey" PRIMARY KEY ("pointOfInterestId", "service")
);
ALTER TABLE "PointOfInterestServiceAssignment" ADD CONSTRAINT "PointOfInterestServiceAssignment_pointOfInterestId_fkey" FOREIGN KEY ("pointOfInterestId") REFERENCES "PointOfInterest"("pointOfInterestId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Soundtrack" (
  "soundtrackId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "sourceFilename" TEXT NOT NULL,
  "cultureSourceKey" TEXT,
  "managedAssetId" TEXT NOT NULL,
  CONSTRAINT "Soundtrack_pkey" PRIMARY KEY ("soundtrackId")
);
CREATE UNIQUE INDEX "Soundtrack_managedAssetId_key" ON "Soundtrack"("managedAssetId");
CREATE INDEX "Soundtrack_cultureSourceKey_idx" ON "Soundtrack"("cultureSourceKey");
ALTER TABLE "Soundtrack" ADD CONSTRAINT "Soundtrack_identity_check" CHECK (length(trim("displayName")) > 0 AND length(trim("sourceFilename")) > 0);
ALTER TABLE "Soundtrack" ADD CONSTRAINT "Soundtrack_managedAssetId_fkey" FOREIGN KEY ("managedAssetId") REFERENCES "ManagedAsset"("managedAssetId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SettlementSoundtrackAssignment" (
  "settlementSoundtrackAssignmentId" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "soundtrackId" TEXT NOT NULL,
  "category" "SoundtrackCategory" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "ordinal" INTEGER NOT NULL,
  CONSTRAINT "SettlementSoundtrackAssignment_pkey" PRIMARY KEY ("settlementSoundtrackAssignmentId")
);
CREATE UNIQUE INDEX "SettlementSoundtrackAssignment_settlementId_category_ordinal_key" ON "SettlementSoundtrackAssignment"("settlementId", "category", "ordinal");
CREATE UNIQUE INDEX "SettlementSoundtrackAssignment_settlementId_soundtrackId_category_key" ON "SettlementSoundtrackAssignment"("settlementId", "soundtrackId", "category");
CREATE INDEX "SettlementSoundtrackAssignment_soundtrackId_idx" ON "SettlementSoundtrackAssignment"("soundtrackId");
ALTER TABLE "SettlementSoundtrackAssignment" ADD CONSTRAINT "SettlementSoundtrackAssignment_ordinal_check" CHECK ("ordinal" >= 0);
ALTER TABLE "SettlementSoundtrackAssignment" ADD CONSTRAINT "SettlementSoundtrackAssignment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("settlementId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementSoundtrackAssignment" ADD CONSTRAINT "SettlementSoundtrackAssignment_soundtrackId_fkey" FOREIGN KEY ("soundtrackId") REFERENCES "Soundtrack"("soundtrackId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WorldInstance" (
  "worldInstanceId" TEXT NOT NULL,
  "worldKey" "WorldKey" NOT NULL,
  "currentGameMinute" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorldInstance_pkey" PRIMARY KEY ("worldInstanceId")
);
ALTER TABLE "WorldInstance" ADD CONSTRAINT "WorldInstance_game_time_check" CHECK ("currentGameMinute" >= 0);

CREATE TABLE "Party" (
  "partyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "worldInstanceId" TEXT NOT NULL,
  "withdrawalLimit" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Party_pkey" PRIMARY KEY ("partyId")
);
CREATE INDEX "Party_userId_idx" ON "Party"("userId");
CREATE INDEX "Party_worldInstanceId_idx" ON "Party"("worldInstanceId");
ALTER TABLE "Party" ADD CONSTRAINT "Party_withdrawal_limit_check" CHECK ("withdrawalLimit" IS NULL OR "withdrawalLimit" >= 0);
ALTER TABLE "Party" ADD CONSTRAINT "Party_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Party" ADD CONSTRAINT "Party_worldInstanceId_fkey" FOREIGN KEY ("worldInstanceId") REFERENCES "WorldInstance"("worldInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PartyMember" (
  "partyId" TEXT NOT NULL,
  "companionKey" "CompanionKey" NOT NULL,
  "rest" DOUBLE PRECISION,
  "morale" DOUBLE PRECISION,
  "comfort" DOUBLE PRECISION,
  "conditionSentence" TEXT,
  CONSTRAINT "PartyMember_pkey" PRIMARY KEY ("partyId", "companionKey")
);
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_finite_recovery_check"
CHECK (("rest" IS NULL OR "rest" NOT IN ('Infinity'::float, '-Infinity'::float) AND "rest" = "rest") AND ("morale" IS NULL OR "morale" NOT IN ('Infinity'::float, '-Infinity'::float) AND "morale" = "morale") AND ("comfort" IS NULL OR "comfort" NOT IN ('Infinity'::float, '-Infinity'::float) AND "comfort" = "comfort"));
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("partyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_companionKey_fkey" FOREIGN KEY ("companionKey") REFERENCES "Companion"("companionKey") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RecoveryPolicy" (
  "recoveryPolicyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "configuration" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecoveryPolicy_pkey" PRIMARY KEY ("recoveryPolicyId")
);
CREATE UNIQUE INDEX "RecoveryPolicy_one_active_key" ON "RecoveryPolicy"("active") WHERE "active" = true;

CREATE TABLE "MoneyTransaction" (
  "moneyTransactionId" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "worldInstanceId" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "withdrawalAmount" INTEGER,
  "occurredAtGameMinute" BIGINT NOT NULL,
  "context" JSONB NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MoneyTransaction_pkey" PRIMARY KEY ("moneyTransactionId")
);
CREATE INDEX "MoneyTransaction_partyId_worldInstanceId_occurredAtGameMinute_idx" ON "MoneyTransaction"("partyId", "worldInstanceId", "occurredAtGameMinute");
CREATE INDEX "MoneyTransaction_recordedAt_idx" ON "MoneyTransaction"("recordedAt");
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_values_check" CHECK ("delta" <> 0 AND ("withdrawalAmount" IS NULL OR "withdrawalAmount" > 0) AND "occurredAtGameMinute" >= 0);
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("partyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_worldInstanceId_fkey" FOREIGN KEY ("worldInstanceId") REFERENCES "WorldInstance"("worldInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GameSession" ADD COLUMN "worldInstanceId" TEXT, ADD COLUMN "partyId" TEXT, ADD COLUMN "currentPointOfInterestId" TEXT;
CREATE INDEX "GameSession_worldInstanceId_idx" ON "GameSession"("worldInstanceId");
CREATE INDEX "GameSession_partyId_idx" ON "GameSession"("partyId");
CREATE INDEX "GameSession_currentPointOfInterestId_idx" ON "GameSession"("currentPointOfInterestId");
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_worldInstanceId_fkey" FOREIGN KEY ("worldInstanceId") REFERENCES "WorldInstance"("worldInstanceId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("partyId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_currentPointOfInterestId_fkey" FOREIGN KEY ("currentPointOfInterestId") REFERENCES "PointOfInterest"("pointOfInterestId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_money_transaction_mutation()
RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'MoneyTransaction history is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "MoneyTransaction_reject_update" BEFORE UPDATE ON "MoneyTransaction" FOR EACH ROW EXECUTE FUNCTION reject_money_transaction_mutation();
CREATE TRIGGER "MoneyTransaction_reject_delete" BEFORE DELETE ON "MoneyTransaction" FOR EACH ROW EXECUTE FUNCTION reject_money_transaction_mutation();

CREATE OR REPLACE FUNCTION validate_soul_companion_key_compatibility()
RETURNS trigger AS $$ BEGIN
  IF TG_TABLE_NAME = 'Companion' THEN
    IF EXISTS (SELECT 1 FROM "Soul" WHERE "soulId" = NEW."soulId" AND "companionKey" IS NOT NULL AND "companionKey" <> NEW."companionKey") THEN
      RAISE EXCEPTION 'Companion key conflicts with the authored Soul companion key';
    END IF;
  ELSE
    IF NEW."companionKey" IS NOT NULL AND EXISTS (SELECT 1 FROM "Companion" WHERE "soulId" = NEW."soulId" AND "companionKey" <> NEW."companionKey") THEN
      RAISE EXCEPTION 'Soul companion key conflicts with the authored Companion relationship';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "Companion_validate_soul_key" BEFORE INSERT OR UPDATE OF "companionKey", "soulId" ON "Companion" FOR EACH ROW EXECUTE FUNCTION validate_soul_companion_key_compatibility();
CREATE TRIGGER "Soul_validate_companion_key" BEFORE UPDATE OF "companionKey" ON "Soul" FOR EACH ROW EXECUTE FUNCTION validate_soul_companion_key_compatibility();
