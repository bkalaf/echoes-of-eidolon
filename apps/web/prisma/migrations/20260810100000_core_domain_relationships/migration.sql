-- DropIndex
DROP INDEX "Research_ownerEntityType_ownerEntityId_idx";

-- AlterTable
ALTER TABLE "Ark"
ALTER COLUMN "status" TYPE "ArkStatus"
USING ("status"::text::"ArkStatus");

-- AlterTable
ALTER TABLE "Companion"
ALTER COLUMN "companionKey" TYPE "CompanionKey"
USING ("companionKey"::text::"CompanionKey"),
ALTER COLUMN "heirloom" TYPE "Heirloom"
USING ("heirloom"::text::"Heirloom");

-- AlterTable
ALTER TABLE "Culture"
ALTER COLUMN "culturePoolId" TYPE "CulturePoolId"
USING ("culturePoolId"::text::"CulturePoolId");

-- AlterTable
ALTER TABLE "KnowledgeBaseItem"
ALTER COLUMN "entityType" TYPE "EntityType"
USING ("entityType"::text::"EntityType");

-- AlterTable
ALTER TABLE "Matrix"
ALTER COLUMN "regionId" TYPE "RegionId"
USING ("regionId"::text::"RegionId"),
ALTER COLUMN "latticeId" TYPE "LatticeId"
USING ("latticeId"::text::"LatticeId"),
ALTER COLUMN "culturePoolIds" TYPE "CulturePoolId"[]
USING ("culturePoolIds"::text[]::"CulturePoolId"[]);

-- AlterTable
ALTER TABLE "PersonalityExpression"
ALTER COLUMN "loquacity" TYPE "Loquacity"
USING ("loquacity"::text::"Loquacity"),
ALTER COLUMN "emotionalTemperature" TYPE "EmotionalTemperature"
USING ("emotionalTemperature"::text::"EmotionalTemperature"),
ALTER COLUMN "outlookOrientation" TYPE "OutlookOrientation"
USING ("outlookOrientation"::text::"OutlookOrientation"),
ALTER COLUMN "collaborativePosture" TYPE "CollaborativePosture"
USING ("collaborativePosture"::text::"CollaborativePosture");

-- AlterTable
ALTER TABLE "PointOfInterest"
ALTER COLUMN "regionId" TYPE "RegionId"
USING ("regionId"::text::"RegionId");

-- AlterTable
ALTER TABLE "Research" DROP COLUMN "citationQuality",
DROP COLUMN "ownerEntityId",
DROP COLUMN "ownerEntityType",
ADD COLUMN     "category" "ResearchCategory";

-- AlterTable
ALTER TABLE "Source"
ALTER COLUMN "sourceType" TYPE "SourceType"
USING ("sourceType"::text::"SourceType");

-- AlterTable
ALTER TABLE "Species" DROP COLUMN "accent";

-- CreateTable
CREATE TABLE "KnowledgeBaseItemCitation" (
    "knowledgeBaseItemId" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,
    "firstUseOrder" INTEGER NOT NULL,

    CONSTRAINT "KnowledgeBaseItemCitation_pkey" PRIMARY KEY ("knowledgeBaseItemId","citationId")
);

-- CreateIndex
CREATE INDEX "KnowledgeBaseItemCitation_citationId_idx" ON "KnowledgeBaseItemCitation"("citationId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBaseItemCitation_knowledgeBaseItemId_firstUseOrder_key" ON "KnowledgeBaseItemCitation"("knowledgeBaseItemId", "firstUseOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Antagonist_characterId_key" ON "Antagonist"("characterId");

-- CreateIndex
CREATE INDEX "Companion_concordProtagonistId_idx" ON "Companion"("concordProtagonistId");

-- CreateIndex
CREATE INDEX "Companion_ruinProtagonistId_idx" ON "Companion"("ruinProtagonistId");

-- CreateIndex
CREATE INDEX "Companion_schismProtagonistId_idx" ON "Companion"("schismProtagonistId");

-- CreateIndex
CREATE INDEX "Companion_soulId_idx" ON "Companion"("soulId");

-- CreateIndex
CREATE INDEX "InterludeSubstitution_interludeId_idx" ON "InterludeSubstitution"("interludeId");

-- CreateIndex
CREATE INDEX "InterludeSubstitution_replacementInterludeId_idx" ON "InterludeSubstitution"("replacementInterludeId");

-- CreateIndex
CREATE UNIQUE INDEX "Protagonist_characterId_key" ON "Protagonist"("characterId");

-- CreateIndex
CREATE INDEX "Witness_antagonist1Id_idx" ON "Witness"("antagonist1Id");

-- CreateIndex
CREATE INDEX "Witness_antagonist2Id_idx" ON "Witness"("antagonist2Id");

-- AddForeignKey
ALTER TABLE "Breed" ADD CONSTRAINT "Breed_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("speciesId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Breed" ADD CONSTRAINT "Breed_cultureId_fkey" FOREIGN KEY ("cultureId") REFERENCES "Culture"("cultureId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("breedId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protagonist" ADD CONSTRAINT "Protagonist_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("characterId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Antagonist" ADD CONSTRAINT "Antagonist_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("characterId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Antagonist" ADD CONSTRAINT "Antagonist_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "Architect"("architectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Antagonist" ADD CONSTRAINT "Antagonist_legendaryRewardId_fkey" FOREIGN KEY ("legendaryRewardId") REFERENCES "LegendaryReward"("legendaryRewardId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Antagonist" ADD CONSTRAINT "Antagonist_puzzleBlueprintId_fkey" FOREIGN KEY ("puzzleBlueprintId") REFERENCES "PuzzleBlueprint"("puzzleBlueprintId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Antagonist" ADD CONSTRAINT "Antagonist_constellationBeforeId_fkey" FOREIGN KEY ("constellationBeforeId") REFERENCES "Constellation"("constellationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Antagonist" ADD CONSTRAINT "Antagonist_constellationAfterId_fkey" FOREIGN KEY ("constellationAfterId") REFERENCES "Constellation"("constellationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_antagonist1Id_fkey" FOREIGN KEY ("antagonist1Id") REFERENCES "Antagonist"("antagonistId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_antagonist2Id_fkey" FOREIGN KEY ("antagonist2Id") REFERENCES "Antagonist"("antagonistId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Companion" ADD CONSTRAINT "Companion_concordProtagonistId_fkey" FOREIGN KEY ("concordProtagonistId") REFERENCES "Protagonist"("protagonistId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Companion" ADD CONSTRAINT "Companion_ruinProtagonistId_fkey" FOREIGN KEY ("ruinProtagonistId") REFERENCES "Protagonist"("protagonistId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Companion" ADD CONSTRAINT "Companion_schismProtagonistId_fkey" FOREIGN KEY ("schismProtagonistId") REFERENCES "Protagonist"("protagonistId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Companion" ADD CONSTRAINT "Companion_soulId_fkey" FOREIGN KEY ("soulId") REFERENCES "Soul"("soulId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterludeSubstitution" ADD CONSTRAINT "InterludeSubstitution_interludeId_fkey" FOREIGN KEY ("interludeId") REFERENCES "Interlude"("interludeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterludeSubstitution" ADD CONSTRAINT "InterludeSubstitution_replacementInterludeId_fkey" FOREIGN KEY ("replacementInterludeId") REFERENCES "Interlude"("interludeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("sourceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Research" ADD CONSTRAINT "Research_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("citationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseItemCitation" ADD CONSTRAINT "KnowledgeBaseItemCitation_knowledgeBaseItemId_fkey" FOREIGN KEY ("knowledgeBaseItemId") REFERENCES "KnowledgeBaseItem"("knowledgeBaseItemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseItemCitation" ADD CONSTRAINT "KnowledgeBaseItemCitation_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("citationId") ON DELETE RESTRICT ON UPDATE CASCADE;
