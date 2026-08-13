-- Action A: canonical Character subtypes, Reward cleanup, and Puzzle intake readiness.
-- This migration is deliberately fail-closed anywhere owner-authored identity cannot be inferred.

DO $$
DECLARE
  blockers JSONB;
BEGIN
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'architectRowsWithoutCharacterAuthority', NULLIF((SELECT COUNT(*) FROM "Architect"), 0),
    'antagonistRowsWithoutWitnessDefAuthority', NULLIF((SELECT COUNT(*) FROM "Antagonist"), 0),
    'legacyWitnessRowsWithoutCanonicalIdentity', NULLIF((SELECT COUNT(*) FROM "Witness"), 0),
    'populatedAntagonistInversionRules', NULLIF((SELECT COUNT(*) FROM "Antagonist" WHERE BTRIM("inversionRule") <> ''), 0),
    'rewardCandidateRows', NULLIF((SELECT COUNT(*) FROM "RewardCandidate"), 0),
    'rewardEvidenceRows', NULLIF((SELECT COUNT(*) FROM "RewardEvidenceEvent"), 0),
    'populatedPillarSeatNumbers', NULLIF((SELECT COUNT(*) FROM "Pillar" WHERE "seatNumber" IS NOT NULL), 0),
    'negativePuzzleGeneratorVersions', NULLIF((SELECT COUNT(*) FROM "PuzzleBlueprintVersion" WHERE "generatorVersion" < 0), 0),
    'companionCapabilityEvents', NULLIF((
      SELECT COUNT(*) FROM "CapabilityEvent" event
      JOIN "CapabilityAddress" address ON address."capabilityAddressId" = event."capabilityAddressId"
      JOIN "CapabilityDefinition" definition ON definition."capabilityDefinitionId" = address."capabilityDefinitionId"
      WHERE definition."code" IN ('COMPANION_TRANSFORMATION_COMPLETE', 'COMPANION_LAYETTE_GRANTED')
    ), 0),
    'companionCapabilityStates', NULLIF((
      SELECT COUNT(*) FROM "CapabilityState" state
      JOIN "CapabilityAddress" address ON address."capabilityAddressId" = state."capabilityAddressId"
      JOIN "CapabilityDefinition" definition ON definition."capabilityDefinitionId" = address."capabilityDefinitionId"
      WHERE definition."code" IN ('COMPANION_TRANSFORMATION_COMPLETE', 'COMPANION_LAYETTE_GRANTED')
    ), 0)
  )) INTO blockers;
  IF blockers <> '{}'::jsonb THEN
    RAISE EXCEPTION 'canonical type unification blocked: %', blockers::text;
  END IF;
END $$;

DO $$
DECLARE
  conflicts JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(problem)), '[]'::jsonb)
  INTO conflicts
  FROM (
    SELECT companion."companionKey"::text AS identity, 'duplicate world character' AS reason
    FROM "Companion" companion
    JOIN "Protagonist" concord ON concord."protagonistId" = companion."concordProtagonistId"
    JOIN "Protagonist" ruin ON ruin."protagonistId" = companion."ruinProtagonistId"
    JOIN "Protagonist" schism ON schism."protagonistId" = companion."schismProtagonistId"
    WHERE concord."characterId" = ruin."characterId" OR concord."characterId" = schism."characterId" OR ruin."characterId" = schism."characterId"
    UNION ALL
    SELECT companion."companionKey"::text, 'world slot mismatch'
    FROM "Companion" companion
    JOIN "Protagonist" concord ON concord."protagonistId" = companion."concordProtagonistId"
    JOIN "Protagonist" ruin ON ruin."protagonistId" = companion."ruinProtagonistId"
    JOIN "Protagonist" schism ON schism."protagonistId" = companion."schismProtagonistId"
    WHERE concord."worldKey" IS DISTINCT FROM 'CONCORD'::"WorldKey"
       OR ruin."worldKey" IS DISTINCT FROM 'RUIN'::"WorldKey"
       OR schism."worldKey" IS DISTINCT FROM 'SCHISM'::"WorldKey"
    UNION ALL
    SELECT companion."companionKey"::text, 'skill or heirloom disagreement'
    FROM "Companion" companion
    JOIN "Protagonist" concord ON concord."protagonistId" = companion."concordProtagonistId"
    JOIN "Protagonist" ruin ON ruin."protagonistId" = companion."ruinProtagonistId"
    JOIN "Protagonist" schism ON schism."protagonistId" = companion."schismProtagonistId"
    WHERE concord."knowledgeSkill" IS NULL OR concord."awarenessSkill" IS NULL
       OR concord."knowledgeSkill" IS DISTINCT FROM ruin."knowledgeSkill"
       OR concord."knowledgeSkill" IS DISTINCT FROM schism."knowledgeSkill"
       OR concord."awarenessSkill" IS DISTINCT FROM ruin."awarenessSkill"
       OR concord."awarenessSkill" IS DISTINCT FROM schism."awarenessSkill"
       OR (concord."worldHeirloom" IS NOT NULL AND concord."worldHeirloom" IS DISTINCT FROM companion."heirloom")
       OR (ruin."worldHeirloom" IS NOT NULL AND ruin."worldHeirloom" IS DISTINCT FROM companion."heirloom")
       OR (schism."worldHeirloom" IS NOT NULL AND schism."worldHeirloom" IS DISTINCT FROM companion."heirloom")
    UNION ALL
    SELECT protagonist."protagonistId", 'unowned CompanionDef field'
    FROM "Protagonist" protagonist
    WHERE (protagonist."knowledgeSkill" IS NOT NULL OR protagonist."awarenessSkill" IS NOT NULL OR protagonist."worldHeirloom" IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM "Companion" companion
        WHERE protagonist."protagonistId" IN (companion."concordProtagonistId", companion."ruinProtagonistId", companion."schismProtagonistId")
      )
    UNION ALL
    SELECT protagonist."characterId", 'character reused by multiple Companion definitions'
    FROM "Protagonist" protagonist
    JOIN "Companion" companion ON protagonist."protagonistId" IN (companion."concordProtagonistId", companion."ruinProtagonistId", companion."schismProtagonistId")
    GROUP BY protagonist."characterId"
    HAVING COUNT(*) <> 1
  ) problem;
  IF conflicts <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Companion/Protagonist migration conflicts: %', conflicts::text;
  END IF;
END $$;

-- Preserve the immutable version-1 definitions and append Character-owned version 2 definitions.
UPDATE "CapabilityDefinitionVersion" version SET "status" = 'RETIRED'
FROM "CapabilityDefinition" definition
WHERE version."capabilityDefinitionId" = definition."capabilityDefinitionId"
  AND version."version" = 1
  AND version."status" = 'ACTIVE'
  AND definition."code" IN ('COMPANION_TRANSFORMATION_COMPLETE', 'COMPANION_LAYETTE_GRANTED');

INSERT INTO "CapabilityDefinitionVersion" (
  "capabilityDefinitionVersionId", "capabilityDefinitionId", "version", "pathPattern", "valueKind",
  "enumValues", "allowedReferenceEntityTypes", "allowedOperations", "monotonicPolicy", "initialBoolean",
  "description", "status", "createdAt"
) SELECT
  CASE definition."code" WHEN 'COMPANION_TRANSFORMATION_COMPLETE' THEN 'CAP-VER-COMPANION-TRANSFORMATION-2' ELSE 'CAP-VER-COMPANION-LAYETTE-GRANTED-2' END,
  definition."capabilityDefinitionId", 2,
  CASE definition."code" WHEN 'COMPANION_TRANSFORMATION_COMPLETE' THEN 'character/{CHARACTER}/transformed' ELSE 'character/{CHARACTER}/layette' END,
  version."valueKind", version."enumValues", version."allowedReferenceEntityTypes", version."allowedOperations",
  version."monotonicPolicy", version."initialBoolean", version."description", 'ACTIVE', CURRENT_TIMESTAMP
FROM "CapabilityDefinition" definition
JOIN "CapabilityDefinitionVersion" version ON version."capabilityDefinitionId" = definition."capabilityDefinitionId" AND version."version" = 1
WHERE definition."code" IN ('COMPANION_TRANSFORMATION_COMPLETE', 'COMPANION_LAYETTE_GRANTED');

INSERT INTO "CapabilityParameterDefinition" (
  "capabilityParameterDefinitionId", "capabilityDefinitionVersionId", "name", "kind", "entityType", "allowedValues", "ordinal"
) SELECT
  CASE definition."code" WHEN 'COMPANION_TRANSFORMATION_COMPLETE' THEN 'CAP-PARAM-COMPANION-TRANSFORMATION-2' ELSE 'CAP-PARAM-COMPANION-LAYETTE-GRANTED-2' END,
  CASE definition."code" WHEN 'COMPANION_TRANSFORMATION_COMPLETE' THEN 'CAP-VER-COMPANION-TRANSFORMATION-2' ELSE 'CAP-VER-COMPANION-LAYETTE-GRANTED-2' END,
  'CHARACTER', 'ENTITY', 'CHARACTER'::"EntityType", ARRAY[]::TEXT[], 0
FROM "CapabilityDefinition" definition
WHERE definition."code" IN ('COMPANION_TRANSFORMATION_COMPLETE', 'COMPANION_LAYETTE_GRANTED');

DO $$
DECLARE blockers JSONB;
BEGIN
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'protagonist', NULLIF((SELECT COUNT(*) FROM "KnowledgeBaseItem" WHERE "entityType" = 'PROTAGONIST'), 0),
    'antagonist', NULLIF((SELECT COUNT(*) FROM "KnowledgeBaseItem" WHERE "entityType" = 'ANTAGONIST'), 0),
    'department', NULLIF((SELECT COUNT(*) FROM "KnowledgeBaseItem" WHERE "entityType" = 'DEPARTMENT'), 0),
    'matrix', NULLIF((SELECT COUNT(*) FROM "KnowledgeBaseItem" WHERE "entityType" = 'MATRIX'), 0),
    'unresolvedCompanionParameters', NULLIF((SELECT COUNT(*) FROM "CapabilityParameterDefinition" parameter WHERE parameter."entityType" = 'COMPANION' AND parameter."capabilityDefinitionVersionId" NOT IN ('CAP-VER-COMPANION-TRANSFORMATION-1','CAP-VER-COMPANION-LAYETTE-GRANTED-1')), 0),
    'obsoleteCapabilityReferences', NULLIF((SELECT COUNT(*) FROM "CapabilityEvent" WHERE "referenceEntityType" IN ('PROTAGONIST','ANTAGONIST','DEPARTMENT','MATRIX','COMPANION') OR "sourceEntityType" IN ('PROTAGONIST','ANTAGONIST','DEPARTMENT','MATRIX','COMPANION')), 0),
    'obsoleteCapabilityStates', NULLIF((SELECT COUNT(*) FROM "CapabilityState" WHERE "referenceEntityType" IN ('PROTAGONIST','ANTAGONIST','DEPARTMENT','MATRIX','COMPANION')), 0),
    'obsoleteFactionSources', NULLIF((SELECT COUNT(*) FROM "FactionStandingEvidenceEvent" WHERE "sourceEntityType" IN ('PROTAGONIST','ANTAGONIST','DEPARTMENT','MATRIX','COMPANION')), 0),
    'obsoleteGroupingReferences', NULLIF((SELECT COUNT(*) FROM "BookGroupingValue" WHERE "valueRefType" IN ('PROTAGONIST','ANTAGONIST','DEPARTMENT','MATRIX')), 0)
  )) INTO blockers;
  IF blockers <> '{}'::jsonb THEN RAISE EXCEPTION 'obsolete EntityType references require owner review: %', blockers::text; END IF;
END $$;

CREATE TYPE "ArchitectDepartment" AS ENUM ('ASTRONOMY', 'NAVIGATION', 'PROPULSION', 'HABITABILITY', 'PLANETOLOGY', 'PHYSICS', 'CHEMISTRY', 'COMPUTING', 'MATERIALS', 'ENERGY', 'NANOTECHNOLOGY', 'BIOLOGY', 'GENETICS', 'CRYOBIOLOGY', 'NEUROSCIENCE', 'MEDICINE', 'EPIDEMIOLOGY', 'ECOLOGY', 'TERRAFORMING', 'AGRICULTURE', 'BOTANY', 'ZOOLOGY', 'MICROBIOLOGY', 'INTELLIGENCE', 'ALIGNMENT', 'SOFTWARE', 'CYBERSECURITY', 'CONTINUITY', 'ARCHIVES', 'SYSTEMS', 'ARCHITECTURE', 'ROBOTICS', 'ELECTRICAL', 'MANUFACTURING', 'LOGISTICS', 'RESOURCES', 'RECYCLING', 'SAFETY', 'RELIABILITY', 'COMMAND', 'GOVERNANCE', 'JUSTICE', 'ECONOMICS', 'ADMINISTRATION', 'SOCIOLOGY', 'PSYCHOLOGY', 'ANTHROPOLOGY', 'HISTORY', 'EDUCATION', 'LINGUISTICS', 'HUMANITIES', 'OUTREACH', 'PATRON', 'TECHNOCRAT');
CREATE TYPE "WitnessColor" AS ENUM ('BLACK', 'RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'WHITE');

ALTER TABLE "Character" ADD COLUMN "age" INTEGER, ADD COLUMN "faction" "Faction", ADD COLUMN "gender" TEXT,
  ADD COLUMN "occupationId" TEXT, ADD COLUMN "primaryAttribute" "AbilityType", ADD COLUMN "secondaryAttribute" "AbilityType",
  ADD COLUMN "soulId" TEXT, ADD COLUMN "worldKey" "WorldKey";

UPDATE "Character" character SET
  "age" = protagonist."age", "faction" = protagonist."faction", "gender" = protagonist."gender",
  "occupationId" = protagonist."occupationId", "primaryAttribute" = protagonist."primaryAttribute",
  "secondaryAttribute" = protagonist."secondaryAttribute", "worldKey" = protagonist."worldKey"
FROM "Protagonist" protagonist WHERE protagonist."characterId" = character."characterId";

UPDATE "Character" character SET "soulId" = companion."soulId"
FROM "Protagonist" protagonist JOIN "Companion" companion
  ON protagonist."protagonistId" IN (companion."concordProtagonistId", companion."ruinProtagonistId", companion."schismProtagonistId")
WHERE protagonist."characterId" = character."characterId";

CREATE TABLE "CompanionDef" (
  "companionKey" "CompanionKey" NOT NULL, "concordCharacterId" TEXT NOT NULL, "ruinCharacterId" TEXT NOT NULL,
  "schismCharacterId" TEXT NOT NULL, "soulId" TEXT NOT NULL, "heirloom" "Heirloom" NOT NULL,
  "knowledgeSkill" "KnowledgeSkill" NOT NULL, "awarenessSkill" "AwarenessSkill" NOT NULL,
  CONSTRAINT "CompanionDef_pkey" PRIMARY KEY ("companionKey")
);
INSERT INTO "CompanionDef" ("companionKey","concordCharacterId","ruinCharacterId","schismCharacterId","soulId","heirloom","knowledgeSkill","awarenessSkill")
SELECT companion."companionKey", concord."characterId", ruin."characterId", schism."characterId", companion."soulId", companion."heirloom", concord."knowledgeSkill", concord."awarenessSkill"
FROM "Companion" companion
JOIN "Protagonist" concord ON concord."protagonistId" = companion."concordProtagonistId"
JOIN "Protagonist" ruin ON ruin."protagonistId" = companion."ruinProtagonistId"
JOIN "Protagonist" schism ON schism."protagonistId" = companion."schismProtagonistId";

ALTER TABLE "PartyMember" DROP CONSTRAINT "PartyMember_companionKey_fkey";
ALTER TABLE "PartyMember" ADD COLUMN "characterId" TEXT;
UPDATE "PartyMember" member SET "characterId" = CASE world."worldKey"
  WHEN 'CONCORD'::"WorldKey" THEN definition."concordCharacterId"
  WHEN 'RUIN'::"WorldKey" THEN definition."ruinCharacterId"
  WHEN 'SCHISM'::"WorldKey" THEN definition."schismCharacterId" END
FROM "Party" party, "WorldInstance" world, "CompanionDef" definition
WHERE party."partyId" = member."partyId"
  AND world."worldInstanceId" = party."worldInstanceId"
  AND definition."companionKey" = member."companionKey";
ALTER TABLE "PartyMember" ALTER COLUMN "characterId" SET NOT NULL;
ALTER TABLE "PartyMember" DROP CONSTRAINT "PartyMember_pkey";
ALTER TABLE "PartyMember" DROP COLUMN "companionKey";
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_pkey" PRIMARY KEY ("partyId", "characterId");

ALTER TABLE "CompanionTransformationBinding" DROP CONSTRAINT "CompanionTransformationBinding_companionKey_fkey";
DROP TRIGGER "Companion_validate_soul_key" ON "Companion";
DROP TRIGGER "Soul_validate_companion_key" ON "Soul";
DROP FUNCTION validate_soul_companion_key_compatibility();
ALTER TABLE "Companion" DROP CONSTRAINT "Companion_concordProtagonistId_fkey";
ALTER TABLE "Companion" DROP CONSTRAINT "Companion_ruinProtagonistId_fkey";
ALTER TABLE "Companion" DROP CONSTRAINT "Companion_schismProtagonistId_fkey";
ALTER TABLE "Companion" DROP CONSTRAINT "Companion_soulId_fkey";
DROP TABLE "Companion";

CREATE TABLE "Companion" ("characterId" TEXT NOT NULL, "companionKey" "CompanionKey" NOT NULL, CONSTRAINT "Companion_pkey" PRIMARY KEY ("characterId"));
INSERT INTO "Companion" ("characterId", "companionKey")
SELECT "concordCharacterId", "companionKey" FROM "CompanionDef" UNION ALL
SELECT "ruinCharacterId", "companionKey" FROM "CompanionDef" UNION ALL
SELECT "schismCharacterId", "companionKey" FROM "CompanionDef";

ALTER TABLE "Protagonist" DROP CONSTRAINT "Protagonist_characterId_fkey";
ALTER TABLE "Protagonist" DROP CONSTRAINT "Protagonist_occupationId_fkey";
DROP TABLE "Protagonist";

ALTER TABLE "Antagonist" DROP CONSTRAINT "Antagonist_characterId_fkey";
ALTER TABLE "Antagonist" DROP CONSTRAINT "Antagonist_architectId_fkey";
ALTER TABLE "Antagonist" DROP CONSTRAINT "Antagonist_legendaryRewardId_fkey";
ALTER TABLE "Antagonist" DROP CONSTRAINT "Antagonist_puzzleBlueprintId_fkey";
ALTER TABLE "Antagonist" DROP CONSTRAINT "Antagonist_constellationBeforeId_fkey";
ALTER TABLE "Antagonist" DROP CONSTRAINT "Antagonist_constellationAfterId_fkey";
ALTER TABLE "Witness" DROP CONSTRAINT "Witness_antagonist1Id_fkey";
ALTER TABLE "Witness" DROP CONSTRAINT "Witness_antagonist2Id_fkey";
DROP TABLE "Witness";
DROP TABLE "Antagonist";

DROP TABLE "Architect";
CREATE TABLE "Architect" ("architectId" TEXT NOT NULL, "characterId" TEXT NOT NULL, "department" "ArchitectDepartment" NOT NULL, "profession" TEXT, CONSTRAINT "Architect_pkey" PRIMARY KEY ("architectId"));
CREATE TABLE "WitnessDef" ("witnessDefId" TEXT NOT NULL, "name" TEXT NOT NULL, "department" "ArchitectDepartment" NOT NULL, "apparentDomain" TEXT NOT NULL, "realDomain" TEXT NOT NULL, "color" "WitnessColor" NOT NULL, CONSTRAINT "WitnessDef_pkey" PRIMARY KEY ("witnessDefId"));
CREATE TABLE "Witness" ("witnessId" TEXT NOT NULL, "characterId" TEXT NOT NULL, "witnessDefId" TEXT NOT NULL, "trueFlawName" TEXT NOT NULL, "architectId" TEXT NOT NULL, "legendaryRewardId" TEXT NOT NULL, "constellationBeforeId" TEXT, "constellationAfterId" TEXT, CONSTRAINT "Witness_pkey" PRIMARY KEY ("witnessId"));

ALTER TABLE "Soul" DROP COLUMN "companionKey";
ALTER TABLE "Pillar" DROP COLUMN "seatNumber";

DROP TABLE "RewardEvidenceEvent";
DROP TABLE "RewardCandidate";
DROP TABLE "RewardScoringWeight";
DROP TABLE "RewardScoringPolicy";

ALTER TABLE "PuzzleHintTemplate" DROP CONSTRAINT "PuzzleHintTemplate_version_fkey";
ALTER TABLE "PuzzleChallengeAccepted" DROP CONSTRAINT "PuzzleChallengeAccepted_version_fkey";
ALTER TABLE "PuzzleBlueprintVersion" DROP CONSTRAINT "PuzzleBlueprintVersion_pkey";
ALTER TABLE "PuzzleHintTemplate" DROP CONSTRAINT "PuzzleHintTemplate_pkey";
ALTER TABLE "PuzzleBlueprint" RENAME COLUMN "family" TO "primaryFamily";
ALTER TABLE "PuzzleBlueprint" ADD COLUMN "title" TEXT;
UPDATE "PuzzleBlueprint" SET "title" = "puzzleBlueprintId";
ALTER TABLE "PuzzleBlueprint" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "PuzzleBlueprintVersion" ADD COLUMN "design" JSONB;
UPDATE "PuzzleBlueprintVersion" SET "design" = jsonb_build_object('schemaVersion','legacy-v0');
ALTER TABLE "PuzzleBlueprintVersion" ALTER COLUMN "design" SET NOT NULL;
ALTER TABLE "PuzzleBlueprintVersion" ALTER COLUMN "generatorVersion" TYPE TEXT USING ("generatorVersion"::text || '.0.0');
ALTER TABLE "PuzzleHintTemplate" ALTER COLUMN "generatorVersion" TYPE TEXT USING ("generatorVersion"::text || '.0.0');
ALTER TABLE "PuzzleChallengeAccepted" ALTER COLUMN "generatorVersion" TYPE TEXT USING ("generatorVersion"::text || '.0.0');
ALTER TABLE "PuzzleBlueprintVersion" ADD CONSTRAINT "PuzzleBlueprintVersion_pkey" PRIMARY KEY ("puzzleBlueprintId", "generatorVersion");
ALTER TABLE "PuzzleHintTemplate" ADD CONSTRAINT "PuzzleHintTemplate_pkey" PRIMARY KEY ("puzzleBlueprintId", "generatorVersion", "level");

CREATE OR REPLACE FUNCTION validate_puzzle_version_hints()
RETURNS trigger AS $$
DECLARE
  blueprint_id TEXT;
  version_number TEXT;
  hint_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    blueprint_id := OLD."puzzleBlueprintId";
    version_number := OLD."generatorVersion";
  ELSE
    blueprint_id := NEW."puzzleBlueprintId";
    version_number := NEW."generatorVersion";
  END IF;
  IF EXISTS (
    SELECT 1 FROM "PuzzleBlueprintVersion"
    WHERE "puzzleBlueprintId" = blueprint_id AND "generatorVersion" = version_number
  ) THEN
    SELECT count(*) INTO hint_count FROM "PuzzleHintTemplate"
    WHERE "puzzleBlueprintId" = blueprint_id AND "generatorVersion" = version_number;
    IF hint_count <> 2 THEN RAISE EXCEPTION 'PuzzleBlueprintVersion requires exactly two authored hints'; END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

BEGIN;
CREATE TYPE "EntityType_new" AS ENUM ('CULTURE','CHARACTER','WITNESS','ARCHITECT','SPECIES','SPECIES_GROUP','BREED','PERSONALITY_EXPRESSION','TIMELINE_EVENT','INTERLUDE','INTERLUDE_SUBSTITUTION','PILLAR','LESSON','TRANSITION','LAYETTE','ARK','CONSTELLATION','LEGENDARY_REWARD','SOUL','POINT_OF_INTEREST','SITE','SETTLEMENT','COMPANION','TOME','DEFINITION','KNOWLEDGE_BASE_ITEM','CAPABILITY_DEFINITION','ACHIEVEMENT_DEFINITION','SOURCE','CITATION','AUTHORED_NARRATIVE','NPC_CONVERSATION_GRAPH','ITEM','OCCUPATION','PARTY','SOUNDTRACK','WORLD_INSTANCE');
ALTER TABLE "CapabilityDefinitionVersion" ALTER COLUMN "allowedReferenceEntityTypes" DROP DEFAULT;
ALTER TABLE "KnowledgeBaseItem" ALTER COLUMN "entityType" TYPE "EntityType_new" USING ("entityType"::text::"EntityType_new");
ALTER TABLE "CapabilityDefinitionVersion" ALTER COLUMN "allowedReferenceEntityTypes" TYPE "EntityType_new"[] USING ("allowedReferenceEntityTypes"::text::"EntityType_new"[]);
ALTER TABLE "CapabilityDefinitionVersion" ALTER COLUMN "initialReferenceEntityType" TYPE "EntityType_new" USING ("initialReferenceEntityType"::text::"EntityType_new");
ALTER TABLE "CapabilityParameterDefinition" ALTER COLUMN "entityType" TYPE "EntityType_new" USING ("entityType"::text::"EntityType_new");
ALTER TABLE "CapabilityEvent" ALTER COLUMN "referenceEntityType" TYPE "EntityType_new" USING ("referenceEntityType"::text::"EntityType_new");
ALTER TABLE "CapabilityEvent" ALTER COLUMN "sourceEntityType" TYPE "EntityType_new" USING ("sourceEntityType"::text::"EntityType_new");
ALTER TABLE "CapabilityState" ALTER COLUMN "referenceEntityType" TYPE "EntityType_new" USING ("referenceEntityType"::text::"EntityType_new");
ALTER TABLE "FactionStandingEvidenceEvent" ALTER COLUMN "sourceEntityType" TYPE "EntityType_new" USING ("sourceEntityType"::text::"EntityType_new");
ALTER TABLE "BookGroupingValue" ALTER COLUMN "valueRefType" TYPE "EntityType_new" USING ("valueRefType"::text::"EntityType_new");
ALTER TYPE "EntityType" RENAME TO "EntityType_old";
ALTER TYPE "EntityType_new" RENAME TO "EntityType";
DROP TYPE "EntityType_old";
ALTER TABLE "CapabilityDefinitionVersion" ALTER COLUMN "allowedReferenceEntityTypes" SET DEFAULT ARRAY[]::"EntityType"[];
COMMIT;

DROP TYPE "ProtagonistImportance";
DROP TYPE "DepartmentWitnessPathStatus";
DROP TYPE "PuzzleSharedComponentId";
DROP TYPE "RewardEvidenceKind";

CREATE UNIQUE INDEX "CompanionDef_concordCharacterId_key" ON "CompanionDef"("concordCharacterId");
CREATE UNIQUE INDEX "CompanionDef_ruinCharacterId_key" ON "CompanionDef"("ruinCharacterId");
CREATE UNIQUE INDEX "CompanionDef_schismCharacterId_key" ON "CompanionDef"("schismCharacterId");
CREATE INDEX "CompanionDef_concordCharacterId_idx" ON "CompanionDef"("concordCharacterId");
CREATE INDEX "CompanionDef_ruinCharacterId_idx" ON "CompanionDef"("ruinCharacterId");
CREATE INDEX "CompanionDef_schismCharacterId_idx" ON "CompanionDef"("schismCharacterId");
CREATE INDEX "CompanionDef_soulId_idx" ON "CompanionDef"("soulId");
CREATE INDEX "Character_occupationId_idx" ON "Character"("occupationId");
CREATE INDEX "Character_soulId_idx" ON "Character"("soulId");
CREATE UNIQUE INDEX "Architect_characterId_key" ON "Architect"("characterId");
CREATE UNIQUE INDEX "Witness_characterId_key" ON "Witness"("characterId");
CREATE INDEX "Witness_witnessDefId_idx" ON "Witness"("witnessDefId");
CREATE INDEX "Witness_architectId_idx" ON "Witness"("architectId");
CREATE INDEX "Witness_legendaryRewardId_idx" ON "Witness"("legendaryRewardId");
CREATE INDEX "Companion_companionKey_idx" ON "Companion"("companionKey");

ALTER TABLE "Character" ADD CONSTRAINT "Character_occupationId_fkey" FOREIGN KEY ("occupationId") REFERENCES "Occupation"("occupationId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_soulId_fkey" FOREIGN KEY ("soulId") REFERENCES "Soul"("soulId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Architect" ADD CONSTRAINT "Architect_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("characterId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("characterId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_witnessDefId_fkey" FOREIGN KEY ("witnessDefId") REFERENCES "WitnessDef"("witnessDefId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "Architect"("architectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_legendaryRewardId_fkey" FOREIGN KEY ("legendaryRewardId") REFERENCES "LegendaryReward"("legendaryRewardId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_constellationBeforeId_fkey" FOREIGN KEY ("constellationBeforeId") REFERENCES "Constellation"("constellationId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_constellationAfterId_fkey" FOREIGN KEY ("constellationAfterId") REFERENCES "Constellation"("constellationId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanionDef" ADD CONSTRAINT "CompanionDef_concordCharacterId_fkey" FOREIGN KEY ("concordCharacterId") REFERENCES "Character"("characterId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanionDef" ADD CONSTRAINT "CompanionDef_ruinCharacterId_fkey" FOREIGN KEY ("ruinCharacterId") REFERENCES "Character"("characterId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanionDef" ADD CONSTRAINT "CompanionDef_schismCharacterId_fkey" FOREIGN KEY ("schismCharacterId") REFERENCES "Character"("characterId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanionDef" ADD CONSTRAINT "CompanionDef_soulId_fkey" FOREIGN KEY ("soulId") REFERENCES "Soul"("soulId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Companion" ADD CONSTRAINT "Companion_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("characterId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Companion" ADD CONSTRAINT "Companion_companionKey_fkey" FOREIGN KEY ("companionKey") REFERENCES "CompanionDef"("companionKey") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanionTransformationBinding" ADD CONSTRAINT "CompanionTransformationBinding_companionKey_fkey" FOREIGN KEY ("companionKey") REFERENCES "CompanionDef"("companionKey") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PuzzleHintTemplate" ADD CONSTRAINT "PuzzleHintTemplate_version_fkey" FOREIGN KEY ("puzzleBlueprintId", "generatorVersion") REFERENCES "PuzzleBlueprintVersion"("puzzleBlueprintId", "generatorVersion") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PuzzleChallengeAccepted" ADD CONSTRAINT "PuzzleChallengeAccepted_version_fkey" FOREIGN KEY ("puzzleBlueprintId", "generatorVersion") REFERENCES "PuzzleBlueprintVersion"("puzzleBlueprintId", "generatorVersion") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Companion"("characterId") ON DELETE RESTRICT ON UPDATE CASCADE;
