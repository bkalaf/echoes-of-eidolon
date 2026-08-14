-- WorldBuilding v3 contract and retirement. Fail closed before destructive changes.
DO $$
DECLARE blockers JSONB;
BEGIN
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'breedMissingGroupId', NULLIF((SELECT count(*) FROM "Breed" WHERE "groupIdV3" IS NULL), 0),
    'breedInvalidGroupSpeciesKind', NULLIF((SELECT count(*) FROM "Breed" b JOIN "Species" s ON s."speciesId"=b."speciesId" WHERE left(b."groupIdV3"::text,1) <> CASE s."speciesKind" WHEN 'BEAST' THEN 'B' WHEN 'HUMAN' THEN 'H' WHEN 'MYTHOS' THEN 'M' WHEN 'PET' THEN 'P' END), 0),
    'characterMissingRequiredStrings', NULLIF((SELECT count(*) FROM "Character" WHERE "ageV3" IS NULL OR btrim("ageV3")='' OR "skinScaleColorV3" IS NULL OR btrim("skinScaleColorV3")='' OR "hairFurColorV3" IS NULL OR btrim("hairFurColorV3")='' OR "eyeColorV3" IS NULL OR btrim("eyeColorV3")='' OR "clothingV3" IS NULL OR btrim("clothingV3")=''), 0),
    'speciesGroupRows', NULLIF((SELECT count(*) FROM "SpeciesGroup"), 0),
    'personalityRegistryCount', CASE WHEN (SELECT count(*) FROM "PersonalityExpression") <> 369 THEN (SELECT count(*) FROM "PersonalityExpression") END,
    'noncanonicalPersonalityRows', NULLIF((SELECT count(*) FROM "PersonalityExpression" WHERE "personalityIdV3" IS NULL OR "familyV3" IS NULL OR "expressionV3" IS NULL OR btrim("expressionV3")='' OR cardinality("dominantFactionV3")=0), 0),
    'breedMissingPersonality', NULLIF((SELECT count(*) FROM "Breed" b JOIN "Species" s ON s."speciesId"=b."speciesId" WHERE s."speciesKind" <> 'PET' AND b."personalityIdV3" IS NULL), 0),
    'petForbiddenRelationships', NULLIF((SELECT count(*) FROM "Breed" b JOIN "Species" s ON s."speciesId"=b."speciesId" WHERE s."speciesKind"='PET' AND (b."cultureId" IS NOT NULL OR b."personalityIdV3" IS NOT NULL)), 0),
    'speciesPresentationLoss', NULLIF((SELECT count(*) FROM "Species" WHERE "appearanceV3" IS DISTINCT FROM CASE WHEN cardinality("appearance")=0 THEN NULL ELSE array_to_string("appearance", '; ') END OR "anthropomorphizationV3" IS DISTINCT FROM CASE WHEN cardinality("anthropomorphization")=0 THEN NULL ELSE array_to_string("anthropomorphization", '; ') END), 0),
    'breedPresentationLoss', NULLIF((SELECT count(*) FROM "Breed" WHERE "appearanceV3" IS DISTINCT FROM CASE WHEN cardinality("appearance")=0 THEN NULL ELSE array_to_string("appearance", '; ') END OR "accentV3" IS DISTINCT FROM CASE WHEN cardinality("accent")=0 THEN NULL ELSE array_to_string("accent", '; ') END OR "clothingV3" IS DISTINCT FROM CASE WHEN cardinality("costume")=0 THEN NULL ELSE array_to_string("costume", '; ') END OR "architectureV3" IS DISTINCT FROM CASE WHEN cardinality("architecture")=0 THEN NULL ELSE array_to_string("architecture", '; ') END), 0),
    'cultureNameLoss', NULLIF((SELECT count(*) FROM "Culture" WHERE "nameV3" IS DISTINCT FROM "cultureName"), 0),
    'speciesGroupKnowledgeBaseRefs', NULLIF((SELECT count(*) FROM "KnowledgeBaseItem" WHERE "entityType"='SPECIES_GROUP'), 0),
    'speciesGroupCapabilityAllowedRefs', NULLIF((SELECT count(*) FROM "CapabilityDefinitionVersion" WHERE 'SPECIES_GROUP'=ANY("allowedReferenceEntityTypes")), 0),
    'speciesGroupCapabilityInitialRefs', NULLIF((SELECT count(*) FROM "CapabilityDefinitionVersion" WHERE "initialReferenceEntityType"='SPECIES_GROUP'), 0),
    'speciesGroupCapabilityParameterRefs', NULLIF((SELECT count(*) FROM "CapabilityParameterDefinition" WHERE "entityType"='SPECIES_GROUP'), 0),
    'speciesGroupCapabilityEventRefs', NULLIF((SELECT count(*) FROM "CapabilityEvent" WHERE "referenceEntityType"='SPECIES_GROUP' OR "sourceEntityType"='SPECIES_GROUP'), 0),
    'speciesGroupCapabilityStateRefs', NULLIF((SELECT count(*) FROM "CapabilityState" WHERE "referenceEntityType"='SPECIES_GROUP'), 0),
    'speciesGroupStandingRefs', NULLIF((SELECT count(*) FROM "FactionStandingEvidenceEvent" WHERE "sourceEntityType"='SPECIES_GROUP'), 0),
    'speciesGroupBookGroupingRefs', NULLIF((SELECT count(*) FROM "BookGroupingValue" WHERE "valueRefType"='SPECIES_GROUP'), 0)
  )) INTO blockers;
  IF blockers <> '{}'::jsonb THEN RAISE EXCEPTION 'WorldBuilding v3 contract blocked: %', blockers::text; END IF;
END $$;

ALTER TABLE "Species"
  DROP COLUMN "appearance",
  DROP COLUMN "anthropomorphization";
ALTER TABLE "Species" RENAME COLUMN "traitsV3" TO "traits";
ALTER TABLE "Species" RENAME COLUMN "accentV3" TO "accent";
ALTER TABLE "Species" RENAME COLUMN "anthropomorphizationV3" TO "anthropomorphization";
ALTER TABLE "Species" RENAME COLUMN "appearanceV3" TO "appearance";
ALTER TABLE "Species" RENAME COLUMN "clothingV3" TO "clothing";
ALTER TABLE "Species" RENAME COLUMN "architectureV3" TO "architecture";
ALTER TABLE "Species" RENAME COLUMN "originModeV3" TO "originMode";
ALTER TABLE "Species" RENAME COLUMN "reproductiveMethodV3" TO "reproductiveMethod";
ALTER TABLE "Species" RENAME COLUMN "juvenileStagesV3" TO "juvenileStages";
ALTER TABLE "Species" RENAME COLUMN "nurseryModeV3" TO "nurseryMode";
ALTER TABLE "Species" RENAME COLUMN "longevityClassV3" TO "longevityClass";
ALTER TABLE "Species" RENAME COLUMN "mortalityModeV3" TO "mortalityMode";
ALTER TABLE "Species" RENAME COLUMN "soulDispositionV3" TO "soulDisposition";
ALTER TABLE "Species" RENAME COLUMN "continuityGroupV3" TO "continuityGroup";
ALTER TABLE "Species" RENAME COLUMN "continuityPropagationModeV3" TO "continuityPropagationMode";
ALTER TABLE "Species"
  ALTER COLUMN "originMode" DROP DEFAULT,
  ALTER COLUMN "reproductiveMethod" DROP DEFAULT,
  ALTER COLUMN "longevityClass" DROP DEFAULT,
  ALTER COLUMN "mortalityMode" DROP DEFAULT,
  ALTER COLUMN "soulDisposition" DROP DEFAULT,
  ALTER COLUMN "continuityGroup" DROP DEFAULT,
  ALTER COLUMN "continuityPropagationMode" DROP DEFAULT;
ALTER TABLE "Species" ADD CONSTRAINT "Species_name_check" CHECK (length(btrim("name")) > 0);

ALTER TABLE "Breed"
  DROP COLUMN "appearance", DROP COLUMN "accent", DROP COLUMN "costume", DROP COLUMN "architecture",
  DROP COLUMN "structuralStability", DROP COLUMN "politicalForm", DROP COLUMN "economicForm";
ALTER TABLE "Breed" RENAME COLUMN "groupIdV3" TO "groupId";
ALTER TABLE "Breed" RENAME COLUMN "personalityIdV3" TO "personalityId";
ALTER TABLE "Breed" RENAME COLUMN "traitsV3" TO "traits";
ALTER TABLE "Breed" RENAME COLUMN "accentV3" TO "accent";
ALTER TABLE "Breed" RENAME COLUMN "appearanceV3" TO "appearance";
ALTER TABLE "Breed" RENAME COLUMN "clothingV3" TO "clothing";
ALTER TABLE "Breed" RENAME COLUMN "architectureV3" TO "architecture";
ALTER TABLE "Breed" RENAME COLUMN "foodBroadV3" TO "foodBroad";
ALTER TABLE "Breed" RENAME COLUMN "foodSpecificV3" TO "foodSpecific";
ALTER TABLE "Breed" RENAME COLUMN "terrainBroadV3" TO "terrainBroad";
ALTER TABLE "Breed" RENAME COLUMN "terrainSpecificV3" TO "terrainSpecific";
ALTER TABLE "Breed" ALTER COLUMN "groupId" SET NOT NULL;
ALTER TABLE "Breed" ADD CONSTRAINT "Breed_name_check" CHECK (length(btrim("name")) > 0);

ALTER TABLE "Culture"
  DROP COLUMN "cultureName", DROP COLUMN "hamletArchitecture", DROP COLUMN "villageArchitecture", DROP COLUMN "townArchitecture", DROP COLUMN "cityArchitecture", DROP COLUMN "metropolisArchitecture", DROP COLUMN "architectureColorPalette", DROP COLUMN "clothingPalette", DROP COLUMN "clothing";
ALTER TABLE "Culture" RENAME COLUMN "nameV3" TO "name";
ALTER TABLE "Culture" RENAME COLUMN "appearanceV3" TO "appearance";
ALTER TABLE "Culture" RENAME COLUMN "clothingV3" TO "clothing";
ALTER TABLE "Culture" RENAME COLUMN "architectureV3" TO "architecture";
ALTER TABLE "Culture" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "Culture" ADD CONSTRAINT "Culture_name_check" CHECK (length(btrim("name")) > 0);

ALTER TABLE "Character" DROP COLUMN "age";
ALTER TABLE "Character" RENAME COLUMN "ageV3" TO "age";
ALTER TABLE "Character" RENAME COLUMN "skinScaleColorV3" TO "skinScaleColor";
ALTER TABLE "Character" RENAME COLUMN "hairFurColorV3" TO "hairFurColor";
ALTER TABLE "Character" RENAME COLUMN "eyeColorV3" TO "eyeColor";
ALTER TABLE "Character" RENAME COLUMN "clothingV3" TO "clothing";
ALTER TABLE "Character" ALTER COLUMN "age" SET NOT NULL, ALTER COLUMN "skinScaleColor" SET NOT NULL, ALTER COLUMN "hairFurColor" SET NOT NULL, ALTER COLUMN "eyeColor" SET NOT NULL, ALTER COLUMN "clothing" SET NOT NULL;
ALTER TABLE "Character" ADD CONSTRAINT "Character_worldbuilding_text_check" CHECK (length(btrim("age"))>0 AND length(btrim("skinScaleColor"))>0 AND length(btrim("hairFurColor"))>0 AND length(btrim("eyeColor"))>0 AND length(btrim("clothing"))>0);

ALTER TABLE "PersonalityExpression" DROP CONSTRAINT "PersonalityExpression_pkey";
ALTER TABLE "PersonalityExpression" DROP COLUMN "personalityExpressionId", DROP COLUMN "name";
ALTER TABLE "PersonalityExpression" RENAME COLUMN "personalityIdV3" TO "personalityId";
ALTER TABLE "PersonalityExpression" RENAME COLUMN "familyV3" TO "family";
ALTER TABLE "PersonalityExpression" RENAME COLUMN "expressionV3" TO "expression";
ALTER TABLE "PersonalityExpression" RENAME COLUMN "dominantFactionV3" TO "dominantFaction";
ALTER TABLE "PersonalityExpression" ALTER COLUMN "personalityId" SET NOT NULL, ALTER COLUMN "family" SET NOT NULL, ALTER COLUMN "expression" SET NOT NULL;
ALTER TABLE "PersonalityExpression" ADD CONSTRAINT "PersonalityExpression_pkey" PRIMARY KEY ("personalityId");
DROP INDEX "PersonalityExpression_personalityIdV3_key";
ALTER TABLE "PersonalityExpression" ADD CONSTRAINT "PersonalityExpression_expression_check" CHECK (length(btrim("expression")) > 0 AND cardinality("dominantFaction") > 0);
CREATE INDEX "Breed_personalityId_idx" ON "Breed"("personalityId");
ALTER TABLE "Breed" ADD CONSTRAINT "Breed_personalityId_fkey" FOREIGN KEY ("personalityId") REFERENCES "PersonalityExpression"("personalityId") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "SpeciesGroup";

ALTER TABLE "CapabilityDefinitionVersion" ALTER COLUMN "allowedReferenceEntityTypes" DROP DEFAULT;
CREATE TYPE "EntityType_new" AS ENUM ('CULTURE', 'CHARACTER', 'WITNESS', 'ARCHITECT', 'SPECIES', 'BREED', 'PERSONALITY_EXPRESSION', 'TIMELINE_EVENT', 'INTERLUDE', 'INTERLUDE_SUBSTITUTION', 'PILLAR', 'LESSON', 'TRANSITION', 'LAYETTE', 'ARK', 'CONSTELLATION', 'LEGENDARY_REWARD', 'SOUL', 'POINT_OF_INTEREST', 'SITE', 'SETTLEMENT', 'COMPANION', 'TOME', 'DEFINITION', 'KNOWLEDGE_BASE_ITEM', 'CAPABILITY_DEFINITION', 'ACHIEVEMENT_DEFINITION', 'SOURCE', 'CITATION', 'AUTHORED_NARRATIVE', 'NPC_CONVERSATION_GRAPH', 'ITEM', 'OCCUPATION', 'PARTY', 'SOUNDTRACK', 'WORLD_INSTANCE');
ALTER TABLE "KnowledgeBaseItem" ALTER COLUMN "entityType" TYPE "EntityType_new" USING ("entityType"::text::"EntityType_new");
ALTER TABLE "CapabilityDefinitionVersion" ALTER COLUMN "allowedReferenceEntityTypes" TYPE "EntityType_new"[] USING ("allowedReferenceEntityTypes"::text::"EntityType_new"[]);
ALTER TABLE "CapabilityDefinitionVersion" ALTER COLUMN "initialReferenceEntityType" TYPE "EntityType_new" USING ("initialReferenceEntityType"::text::"EntityType_new");
ALTER TABLE "CapabilityParameterDefinition" ALTER COLUMN "entityType" TYPE "EntityType_new" USING ("entityType"::text::"EntityType_new");
ALTER TABLE "CapabilityEvent" ALTER COLUMN "referenceEntityType" TYPE "EntityType_new" USING ("referenceEntityType"::text::"EntityType_new");
ALTER TABLE "CapabilityEvent" ALTER COLUMN "sourceEntityType" TYPE "EntityType_new" USING ("sourceEntityType"::text::"EntityType_new");
ALTER TABLE "CapabilityState" ALTER COLUMN "referenceEntityType" TYPE "EntityType_new" USING ("referenceEntityType"::text::"EntityType_new");
ALTER TABLE "FactionStandingEvidenceEvent" ALTER COLUMN "sourceEntityType" TYPE "EntityType_new" USING ("sourceEntityType"::text::"EntityType_new");
ALTER TABLE "BookGroupingValue" ALTER COLUMN "valueRefType" TYPE "EntityType_new" USING ("valueRefType"::text::"EntityType_new");
DROP TYPE "EntityType";
ALTER TYPE "EntityType_new" RENAME TO "EntityType";
ALTER TABLE "CapabilityDefinitionVersion" ALTER COLUMN "allowedReferenceEntityTypes" SET DEFAULT ARRAY[]::"EntityType"[];

ALTER TYPE "TerrainSpecific" RENAME TO "SpecificTerrain";
