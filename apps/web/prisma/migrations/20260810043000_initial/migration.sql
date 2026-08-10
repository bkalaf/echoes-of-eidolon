-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorldKey" AS ENUM ('CONCORD', 'RUIN', 'SCHISM');

-- CreateEnum
CREATE TYPE "SpeciesKind" AS ENUM ('HUMAN', 'BEAST', 'MYTHOS', 'PET');

-- CreateEnum
CREATE TYPE "ProtagonistImportance" AS ENUM ('MINOR', 'MAJOR');

-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('HISTORICAL', 'ATROCITY', 'EXODUS', 'IN_TRANSIT');

-- CreateEnum
CREATE TYPE "InterludeType" AS ENUM ('WWII', 'HISTORICAL', 'MYTH', 'SCIENCE', 'DEJA_VU', 'OTHER');

-- CreateEnum
CREATE TYPE "StructureOrientation" AS ENUM ('ORDERED', 'NEUTRAL', 'CHAOS');

-- CreateEnum
CREATE TYPE "OperatingStyle" AS ENUM ('TEAMWORK', 'SITUATIONAL', 'SOLO');

-- CreateEnum
CREATE TYPE "Motivation" AS ENUM ('ALTRUISTIC', 'RECIPROCAL', 'SELFISH');

-- CreateEnum
CREATE TYPE "AdministrationMode" AS ENUM ('CENTRALIZED', 'DELEGATED', 'DISTRIBUTED');

-- CreateEnum
CREATE TYPE "AuthoritySource" AS ENUM ('APPOINTMENT', 'DIVINE_MANDATE', 'ELECTION');

-- CreateEnum
CREATE TYPE "LegitimacyBasis" AS ENUM ('ANCESTRAL', 'CHARTERED', 'MARTIAL');

-- CreateEnum
CREATE TYPE "AllocationMode" AS ENUM ('CUSTOMARY', 'MARKET', 'PLANNED');

-- CreateEnum
CREATE TYPE "OwnershipMode" AS ENUM ('COMMON_USE', 'SHARED_TITLE', 'SINGLE_ENTITY');

-- CreateEnum
CREATE TYPE "PoliticalForm" AS ENUM ('ACCLAIMED_IMPERATOR', 'APPOINTED_COMMISSION', 'APPOINTED_DIRECTORATE', 'CAPTAINS_COUNCIL', 'CHIEFTAIN_COUNCIL', 'CONSECRATED_REPUBLIC', 'COVENANT_ASSEMBLY', 'COVENANT_CROWN', 'DELEGATE_LEAGUE', 'DIVINE_THRONE', 'ELDER_MOOT', 'ELECTED_EXECUTIVE', 'ELECTIVE_CROWN', 'ESTATES_DIET', 'FEUDAL_ORDER', 'FREE_COMPANY', 'GARRISON_COMMAND', 'HALLOWED_CUSTOM', 'JUNTA', 'MILITANT_ORDER', 'MILITANT_THEOCRACY', 'POPULAR_FEDERATION', 'RAIDER_CONFEDERACY', 'REGENT_THRONE', 'REPUBLIC', 'TEMPLE_HIERARCHY', 'ZEALOT_BANDS');

-- CreateEnum
CREATE TYPE "EconomicForm" AS ENUM ('COMMAND_DEMESNE', 'COMMUNE_PLAN', 'FOLK_COMMONS', 'GUILD_COMPACT', 'MONOPOLY_ESTATE', 'OPEN_BAZAAR', 'SHAREHOLDER_BOURSE', 'SYNDICATE_CARTEL', 'TRIBUTARY_DEMESNE');

-- CreateEnum
CREATE TYPE "CitationQuality" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "CapabilityValueType" AS ENUM ('BOOLEAN', 'SCORE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aaguid" TEXT,

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Species" (
    "speciesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "speciesKind" "SpeciesKind" NOT NULL,
    "scientificName" TEXT,
    "taxonomy" JSONB,
    "appearance" TEXT[],
    "accent" TEXT[],
    "anthropomorphization" TEXT[],

    CONSTRAINT "Species_pkey" PRIMARY KEY ("speciesId")
);

-- CreateTable
CREATE TABLE "Breed" (
    "breedId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "cultureId" TEXT,
    "appearance" TEXT[],
    "accent" TEXT[],
    "costume" TEXT[],
    "architecture" TEXT[],
    "structuralStability" DOUBLE PRECISION,
    "motivation" "Motivation",
    "operatingStyle" "OperatingStyle",
    "structureOrientation" "StructureOrientation",
    "administrationMode" "AdministrationMode",
    "ownershipMode" "OwnershipMode",
    "allocationMode" "AllocationMode",
    "legitimacyBasis" "LegitimacyBasis",
    "authoritySource" "AuthoritySource",
    "politicalForm" "PoliticalForm",
    "economicForm" "EconomicForm",

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("breedId")
);

-- CreateTable
CREATE TABLE "Culture" (
    "cultureId" TEXT NOT NULL,
    "culturePoolId" TEXT NOT NULL,
    "cultureName" TEXT NOT NULL,
    "hamletArchitecture" TEXT NOT NULL,
    "villageArchitecture" TEXT NOT NULL,
    "townArchitecture" TEXT NOT NULL,
    "cityArchitecture" TEXT NOT NULL,
    "metropolisArchitecture" TEXT NOT NULL,
    "architectureColorPalette" TEXT[],
    "clothingPalette" TEXT[],
    "clothing" TEXT NOT NULL,

    CONSTRAINT "Culture_pkey" PRIMARY KEY ("cultureId")
);

-- CreateTable
CREATE TABLE "Character" (
    "characterId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "breedId" TEXT NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("characterId")
);

-- CreateTable
CREATE TABLE "Protagonist" (
    "protagonistId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "importance" "ProtagonistImportance" NOT NULL,
    "worldKey" "WorldKey",

    CONSTRAINT "Protagonist_pkey" PRIMARY KEY ("protagonistId")
);

-- CreateTable
CREATE TABLE "Architect" (
    "architectId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profession" TEXT,

    CONSTRAINT "Architect_pkey" PRIMARY KEY ("architectId")
);

-- CreateTable
CREATE TABLE "Antagonist" (
    "antagonistId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "worldKey" "WorldKey",
    "family" TEXT NOT NULL,
    "trueFlawName" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "presentsAs" TEXT NOT NULL,
    "inversionRule" TEXT NOT NULL,
    "architectId" TEXT NOT NULL,
    "apparentDomain" TEXT NOT NULL,
    "realDomain" TEXT NOT NULL,
    "color" JSONB NOT NULL,
    "legendaryRewardId" TEXT NOT NULL,
    "puzzleBlueprintId" TEXT NOT NULL,
    "constellationBeforeId" TEXT,
    "constellationAfterId" TEXT,

    CONSTRAINT "Antagonist_pkey" PRIMARY KEY ("antagonistId")
);

-- CreateTable
CREATE TABLE "Witness" (
    "witnessId" TEXT NOT NULL,
    "antagonist1Id" TEXT NOT NULL,
    "antagonist2Id" TEXT,

    CONSTRAINT "Witness_pkey" PRIMARY KEY ("witnessId")
);

-- CreateTable
CREATE TABLE "Soul" (
    "soulId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Soul_pkey" PRIMARY KEY ("soulId")
);

-- CreateTable
CREATE TABLE "Companion" (
    "companionKey" TEXT NOT NULL,
    "concordProtagonistId" TEXT NOT NULL,
    "ruinProtagonistId" TEXT NOT NULL,
    "schismProtagonistId" TEXT NOT NULL,
    "soulId" TEXT NOT NULL,
    "heirloom" TEXT NOT NULL,

    CONSTRAINT "Companion_pkey" PRIMARY KEY ("companionKey")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "timelineEventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timelineEventType" "TimelineEventType" NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("timelineEventId")
);

-- CreateTable
CREATE TABLE "Interlude" (
    "interludeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "interludeType" "InterludeType" NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "Interlude_pkey" PRIMARY KEY ("interludeId")
);

-- CreateTable
CREATE TABLE "InterludeSubstitution" (
    "interludeSubstitutionId" TEXT NOT NULL,
    "interludeId" TEXT NOT NULL,
    "replacementInterludeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "InterludeSubstitution_pkey" PRIMARY KEY ("interludeSubstitutionId")
);

-- CreateTable
CREATE TABLE "Pillar" (
    "pillarId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "seatNumber" INTEGER,

    CONSTRAINT "Pillar_pkey" PRIMARY KEY ("pillarId")
);

-- CreateTable
CREATE TABLE "LegendaryReward" (
    "legendaryRewardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "LegendaryReward_pkey" PRIMARY KEY ("legendaryRewardId")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "lessonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("lessonId")
);

-- CreateTable
CREATE TABLE "Tome" (
    "tomeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,

    CONSTRAINT "Tome_pkey" PRIMARY KEY ("tomeId")
);

-- CreateTable
CREATE TABLE "Transition" (
    "transitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bookA" INTEGER NOT NULL,
    "bookB" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "Transition_pkey" PRIMARY KEY ("transitionId")
);

-- CreateTable
CREATE TABLE "Constellation" (
    "constellationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rightAscension" TEXT,
    "declination" TEXT,

    CONSTRAINT "Constellation_pkey" PRIMARY KEY ("constellationId")
);

-- CreateTable
CREATE TABLE "Ark" (
    "arkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Ark_pkey" PRIMARY KEY ("arkId")
);

-- CreateTable
CREATE TABLE "PointOfInterest" (
    "pointOfInterestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PointOfInterest_pkey" PRIMARY KEY ("pointOfInterestId")
);

-- CreateTable
CREATE TABLE "Site" (
    "siteId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "candidateType" TEXT NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "settlementId" TEXT,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("siteId")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "settlementId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("settlementId")
);

-- CreateTable
CREATE TABLE "BreedPopulation" (
    "settlementId" TEXT NOT NULL,
    "worldKey" "WorldKey" NOT NULL,
    "year" INTEGER NOT NULL,
    "breedId" TEXT NOT NULL,
    "population" INTEGER NOT NULL,

    CONSTRAINT "BreedPopulation_pkey" PRIMARY KEY ("settlementId","worldKey","year","breedId")
);

-- CreateTable
CREATE TABLE "Source" (
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "publisher" TEXT,
    "publicationDate" TEXT,
    "sourceType" TEXT NOT NULL,
    "urlOrIdentifier" TEXT,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("sourceId")
);

-- CreateTable
CREATE TABLE "Citation" (
    "citationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "locator" TEXT,
    "rendering" TEXT NOT NULL,
    "quality" "CitationQuality",

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("citationId")
);

-- CreateTable
CREATE TABLE "Research" (
    "researchId" TEXT NOT NULL,
    "ownerEntityType" TEXT NOT NULL,
    "ownerEntityId" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,
    "citationQuality" "CitationQuality" NOT NULL,

    CONSTRAINT "Research_pkey" PRIMARY KEY ("researchId")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseItem" (
    "knowledgeBaseItemId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "baseContent" TEXT NOT NULL,

    CONSTRAINT "KnowledgeBaseItem_pkey" PRIMARY KEY ("knowledgeBaseItemId")
);

-- CreateTable
CREATE TABLE "Definition" (
    "definitionId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,

    CONSTRAINT "Definition_pkey" PRIMARY KEY ("definitionId")
);

-- CreateTable
CREATE TABLE "Matrix" (
    "matrixId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "latticeId" TEXT NOT NULL,
    "culturePoolIds" TEXT[],

    CONSTRAINT "Matrix_pkey" PRIMARY KEY ("matrixId")
);

-- CreateTable
CREATE TABLE "Layette" (
    "layetteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Layette_pkey" PRIMARY KEY ("layetteId")
);

-- CreateTable
CREATE TABLE "PersonalityExpression" (
    "personalityExpressionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loquacity" TEXT NOT NULL,
    "emotionalTemperature" TEXT NOT NULL,
    "outlookOrientation" TEXT NOT NULL,
    "collaborativePosture" TEXT NOT NULL,

    CONSTRAINT "PersonalityExpression_pkey" PRIMARY KEY ("personalityExpressionId")
);

-- CreateTable
CREATE TABLE "CapabilityDefinition" (
    "capabilityDefinitionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueType" "CapabilityValueType" NOT NULL,
    "minValue" INTEGER,
    "maxValue" INTEGER,
    "description" TEXT NOT NULL,

    CONSTRAINT "CapabilityDefinition_pkey" PRIMARY KEY ("capabilityDefinitionId")
);

-- CreateTable
CREATE TABLE "AchievementDefinition" (
    "achievementDefinitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chainKey" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "imageAssetId" TEXT,
    "status" TEXT NOT NULL,

    CONSTRAINT "AchievementDefinition_pkey" PRIMARY KEY ("achievementDefinitionId")
);

-- CreateTable
CREATE TABLE "SpeciesGroup" (
    "speciesGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "speciesKind" "SpeciesKind" NOT NULL,
    "description" TEXT,

    CONSTRAINT "SpeciesGroup_pkey" PRIMARY KEY ("speciesGroupId")
);

-- CreateTable
CREATE TABLE "PuzzleBlueprint" (
    "puzzleBlueprintId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "difficultyTier" INTEGER NOT NULL,
    "hint1" TEXT NOT NULL,
    "hint2" TEXT NOT NULL,
    "generatorVersion" INTEGER NOT NULL,

    CONSTRAINT "PuzzleBlueprint_pkey" PRIMARY KEY ("puzzleBlueprintId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "Passkey_userId_idx" ON "Passkey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialID_key" ON "Passkey"("credentialID");

-- CreateIndex
CREATE INDEX "Breed_speciesId_idx" ON "Breed"("speciesId");

-- CreateIndex
CREATE INDEX "Breed_cultureId_idx" ON "Breed"("cultureId");

-- CreateIndex
CREATE INDEX "Character_breedId_idx" ON "Character"("breedId");

-- CreateIndex
CREATE INDEX "Protagonist_characterId_idx" ON "Protagonist"("characterId");

-- CreateIndex
CREATE INDEX "Antagonist_characterId_idx" ON "Antagonist"("characterId");

-- CreateIndex
CREATE INDEX "Antagonist_architectId_idx" ON "Antagonist"("architectId");

-- CreateIndex
CREATE INDEX "Antagonist_legendaryRewardId_idx" ON "Antagonist"("legendaryRewardId");

-- CreateIndex
CREATE INDEX "Antagonist_puzzleBlueprintId_idx" ON "Antagonist"("puzzleBlueprintId");

-- CreateIndex
CREATE INDEX "PointOfInterest_regionId_idx" ON "PointOfInterest"("regionId");

-- CreateIndex
CREATE INDEX "Site_regionId_idx" ON "Site"("regionId");

-- CreateIndex
CREATE INDEX "Site_settlementId_idx" ON "Site"("settlementId");

-- CreateIndex
CREATE INDEX "Settlement_siteId_idx" ON "Settlement"("siteId");

-- CreateIndex
CREATE INDEX "Settlement_regionId_idx" ON "Settlement"("regionId");

-- CreateIndex
CREATE INDEX "BreedPopulation_breedId_idx" ON "BreedPopulation"("breedId");

-- CreateIndex
CREATE INDEX "Citation_sourceId_idx" ON "Citation"("sourceId");

-- CreateIndex
CREATE INDEX "Research_citationId_idx" ON "Research"("citationId");

-- CreateIndex
CREATE INDEX "Research_ownerEntityType_ownerEntityId_idx" ON "Research"("ownerEntityType", "ownerEntityId");

-- CreateIndex
CREATE INDEX "KnowledgeBaseItem_entityType_entityId_idx" ON "KnowledgeBaseItem"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "CapabilityDefinition_key_key" ON "CapabilityDefinition"("key");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Canonical closed-world invariants that Prisma cannot express in the schema.
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_distinct_antagonists_check"
CHECK ("antagonist2Id" IS NULL OR "antagonist1Id" <> "antagonist2Id");

ALTER TABLE "Companion" ADD CONSTRAINT "Companion_distinct_protagonists_check"
CHECK (
  "concordProtagonistId" <> "ruinProtagonistId"
  AND "concordProtagonistId" <> "schismProtagonistId"
  AND "ruinProtagonistId" <> "schismProtagonistId"
);

ALTER TABLE "BreedPopulation" ADD CONSTRAINT "BreedPopulation_nonnegative_check"
CHECK ("population" >= 0);

ALTER TABLE "PuzzleBlueprint" ADD CONSTRAINT "PuzzleBlueprint_tier_check"
CHECK ("difficultyTier" BETWEEN 1 AND 5);

ALTER TABLE "PuzzleBlueprint" ADD CONSTRAINT "PuzzleBlueprint_authored_hints_check"
CHECK (length("hint1") > 0 AND length("hint2") > 0);
