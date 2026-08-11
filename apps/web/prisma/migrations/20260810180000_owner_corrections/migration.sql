-- Owner corrections are forward-only. Historical migrations remain immutable.

-- Breed, not Species, owns all twelve personality selections and research dimensions.
ALTER TYPE "SpeciesResearchDimension" RENAME TO "BreedResearchDimension";
ALTER TYPE "SpeciesResearchReviewStatus" RENAME TO "BreedResearchReviewStatus";
ALTER TYPE "SpeciesResearchProvenanceKind" RENAME TO "BreedResearchProvenanceKind";
ALTER TYPE "SpeciesDimensionValue" RENAME TO "BreedDimensionValue";

ALTER TABLE "Breed"
  ADD COLUMN "loquacity" "Loquacity",
  ADD COLUMN "emotionalTemperature" "EmotionalTemperature",
  ADD COLUMN "outlookOrientation" "OutlookOrientation",
  ADD COLUMN "collaborativePosture" "CollaborativePosture";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PersonalityExpression") THEN
    RAISE EXCEPTION 'PersonalityExpression contains authoritative selections without an unambiguous Breed relationship';
  END IF;
END
$$;

ALTER TABLE "PersonalityExpression"
  DROP COLUMN "loquacity",
  DROP COLUMN "emotionalTemperature",
  DROP COLUMN "outlookOrientation",
  DROP COLUMN "collaborativePosture";

CREATE TABLE "BreedResearchValue" (
  "breedResearchValueId" TEXT NOT NULL,
  "breedId" TEXT NOT NULL,
  "dimension" "BreedResearchDimension" NOT NULL,
  "value" "BreedDimensionValue" NOT NULL,
  CONSTRAINT "BreedResearchValue_pkey" PRIMARY KEY ("breedResearchValueId")
);

CREATE TABLE "BreedResearchEvidence" (
  "breedResearchEvidenceId" TEXT NOT NULL,
  "breedResearchValueId" TEXT NOT NULL,
  "researchId" TEXT NOT NULL,
  CONSTRAINT "BreedResearchEvidence_pkey" PRIMARY KEY ("breedResearchEvidenceId")
);

CREATE UNIQUE INDEX "BreedResearchValue_breedId_dimension_key" ON "BreedResearchValue"("breedId", "dimension");
CREATE INDEX "BreedResearchValue_breedId_idx" ON "BreedResearchValue"("breedId");
CREATE UNIQUE INDEX "BreedResearchEvidence_researchId_key" ON "BreedResearchEvidence"("researchId");
CREATE INDEX "BreedResearchEvidence_breedResearchValueId_idx" ON "BreedResearchEvidence"("breedResearchValueId");

ALTER TABLE "BreedResearchValue" ADD CONSTRAINT "BreedResearchValue_breedId_fkey"
  FOREIGN KEY ("breedId") REFERENCES "Breed"("breedId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BreedResearchEvidence" ADD CONSTRAINT "BreedResearchEvidence_breedResearchValueId_fkey"
  FOREIGN KEY ("breedResearchValueId") REFERENCES "BreedResearchValue"("breedResearchValueId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BreedResearchEvidence" ADD CONSTRAINT "BreedResearchEvidence_researchId_fkey"
  FOREIGN KEY ("researchId") REFERENCES "Research"("researchId") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Research") THEN
    RAISE EXCEPTION 'Research rows require an authoritative typed-owner backfill before this migration can continue';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION validate_breed_research_value()
RETURNS trigger AS $$
BEGIN
  IF NOT (
    (NEW."dimension" = 'ADMINISTRATION_MODE' AND NEW."value" IN ('CENTRALIZED', 'DELEGATED', 'DISTRIBUTED')) OR
    (NEW."dimension" = 'STRUCTURE_ORIENTATION' AND NEW."value" IN ('ORDERED', 'NEUTRAL', 'CHAOS')) OR
    (NEW."dimension" = 'OPERATING_STYLE' AND NEW."value" IN ('TEAMWORK', 'SITUATIONAL', 'SOLO')) OR
    (NEW."dimension" = 'MOTIVATION' AND NEW."value" IN ('ALTRUISTIC', 'RECIPROCAL', 'SELFISH')) OR
    (NEW."dimension" = 'AUTHORITY_SOURCE' AND NEW."value" IN ('APPOINTMENT', 'DIVINE_MANDATE', 'ELECTION')) OR
    (NEW."dimension" = 'LEGITIMACY_BASIS' AND NEW."value" IN ('ANCESTRAL', 'CHARTERED', 'MARTIAL')) OR
    (NEW."dimension" = 'ALLOCATION_MODE' AND NEW."value" IN ('CUSTOMARY', 'MARKET', 'PLANNED')) OR
    (NEW."dimension" = 'OWNERSHIP_MODE' AND NEW."value" IN ('COMMON_USE', 'SHARED_TITLE', 'SINGLE_ENTITY')) OR
    (NEW."dimension" = 'LOQUACITY' AND NEW."value" IN ('LIGHT_BANTER', 'TALKATIVE', 'TO_THE_POINT')) OR
    (NEW."dimension" = 'EMOTIONAL_TEMPERATURE' AND NEW."value" IN ('COMPOSED', 'IRRITABLE', 'JOYFUL')) OR
    (NEW."dimension" = 'OUTLOOK_ORIENTATION' AND NEW."value" IN ('NEUTRAL', 'OPTIMISTIC', 'PESSIMISTIC')) OR
    (NEW."dimension" = 'COLLABORATIVE_POSTURE' AND NEW."value" IN ('HELPFUL', 'JUST_ENOUGH', 'WITHHOLDING'))
  ) THEN
    RAISE EXCEPTION 'Breed research value does not match its controlled dimension';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BreedResearchValue_validate"
BEFORE INSERT OR UPDATE ON "BreedResearchValue"
FOR EACH ROW EXECUTE FUNCTION validate_breed_research_value();

CREATE OR REPLACE FUNCTION require_typed_research_owner()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "BreedResearchEvidence" WHERE "researchId" = NEW."researchId") THEN
    RAISE EXCEPTION 'Research requires exactly one typed domain owner';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Research_require_typed_owner"
AFTER INSERT OR UPDATE ON "Research"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION require_typed_research_owner();

CREATE OR REPLACE FUNCTION prevent_orphaned_research()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Research" WHERE "researchId" = OLD."researchId")
    AND NOT EXISTS (SELECT 1 FROM "BreedResearchEvidence" WHERE "researchId" = OLD."researchId") THEN
    RAISE EXCEPTION 'Research requires exactly one typed domain owner';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "BreedResearchEvidence_prevent_orphan"
AFTER DELETE OR UPDATE OF "researchId" ON "BreedResearchEvidence"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION prevent_orphaned_research();

-- CapabilityEvent retains all old values while adopting the exact per-kind shape.
DROP TRIGGER "CapabilityEvent_validate" ON "CapabilityEvent";
DROP FUNCTION validate_capability_event();
ALTER TABLE "CapabilityEvent" DROP CONSTRAINT "CapabilityEvent_exactly_one_value_check";
ALTER TABLE "CapabilityEvent" DROP CONSTRAINT "CapabilityEvent_finite_number_check";
DROP INDEX "CapabilityEvent_userId_sequence_key";

ALTER TABLE "CapabilityDefinition"
  ADD COLUMN "allowedReferenceEntityTypes" "EntityType"[] NOT NULL DEFAULT ARRAY[]::"EntityType"[];
ALTER TABLE "CapabilityDefinition" ADD CONSTRAINT "CapabilityDefinition_reference_types_check"
CHECK (
  ("valueKind" = 'REFERENCE' AND cardinality("allowedReferenceEntityTypes") > 0)
  OR ("valueKind" <> 'REFERENCE' AND cardinality("allowedReferenceEntityTypes") = 0)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "CapabilityEvent" event
    JOIN "CapabilityDefinition" definition USING ("capabilityDefinitionId")
    WHERE definition."valueKind" = 'REFERENCE'
  ) THEN
    RAISE EXCEPTION 'Legacy REFERENCE CapabilityEvent tokens cannot be split into entity type and identity without an authoritative mapping';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "CapabilityEvent" event
    JOIN "CapabilityDefinition" definition USING ("capabilityDefinitionId")
    WHERE definition."valueKind" = 'COUNTER'
      AND (event."valueNumber" <> trunc(event."valueNumber") OR abs(event."valueNumber") > 9223372036854775807::float8)
  ) THEN
    RAISE EXCEPTION 'Legacy COUNTER CapabilityEvent contains a non-integer or out-of-range value';
  END IF;
END
$$;

ALTER TABLE "CapabilityEvent"
  RENAME COLUMN "valueBoolean" TO "booleanValue";
ALTER TABLE "CapabilityEvent"
  RENAME COLUMN "valueNumber" TO "scoreValue";
ALTER TABLE "CapabilityEvent"
  RENAME COLUMN "valueToken" TO "enumValue";
ALTER TABLE "CapabilityEvent"
  RENAME COLUMN "createdAt" TO "occurredAt";
ALTER TABLE "CapabilityEvent"
  ADD COLUMN "counterValue" BIGINT,
  ADD COLUMN "referenceEntityType" "EntityType",
  ADD COLUMN "referenceEntityId" TEXT,
  ADD COLUMN "sourceEntityType" "EntityType",
  ADD COLUMN "sourceEntityId" TEXT;

UPDATE "CapabilityEvent" event
SET "counterValue" = event."scoreValue"::BIGINT,
    "scoreValue" = NULL
FROM "CapabilityDefinition" definition
WHERE definition."capabilityDefinitionId" = event."capabilityDefinitionId"
  AND definition."valueKind" = 'COUNTER';

ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_exactly_one_value_check"
CHECK (
  (CASE WHEN "booleanValue" IS NULL THEN 0 ELSE 1 END)
  + (CASE WHEN "scoreValue" IS NULL THEN 0 ELSE 1 END)
  + (CASE WHEN "counterValue" IS NULL THEN 0 ELSE 1 END)
  + (CASE WHEN "enumValue" IS NULL THEN 0 ELSE 1 END)
  + (CASE WHEN "referenceEntityType" IS NULL AND "referenceEntityId" IS NULL THEN 0 ELSE 1 END)
  = 1
  AND (("referenceEntityType" IS NULL) = ("referenceEntityId" IS NULL))
);
ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_finite_score_check"
CHECK ("scoreValue" IS NULL OR "scoreValue" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8));
ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_source_pair_check"
CHECK (("sourceEntityType" IS NULL) = ("sourceEntityId" IS NULL));

CREATE INDEX "CapabilityEvent_userId_occurredAt_sequence_capabilityEventI_idx"
ON "CapabilityEvent"("userId", "occurredAt", "sequence", "capabilityEventId");

CREATE OR REPLACE FUNCTION validate_capability_event()
RETURNS trigger AS $$
DECLARE
  definition "CapabilityDefinition"%ROWTYPE;
  reduced_score DOUBLE PRECISION := 0;
  reduced_counter NUMERIC := 0;
  ordered_event RECORD;
BEGIN
  SELECT * INTO definition FROM "CapabilityDefinition"
  WHERE "capabilityDefinitionId" = NEW."capabilityDefinitionId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown CapabilityDefinition'; END IF;

  IF definition."valueKind" = 'BOOLEAN' THEN
    IF NEW."operation" <> 'SET' OR NEW."booleanValue" IS NULL THEN
      RAISE EXCEPTION 'BOOLEAN capabilities require SET and booleanValue';
    END IF;
  ELSIF definition."valueKind" = 'SCORE' THEN
    IF NEW."scoreValue" IS NULL THEN RAISE EXCEPTION 'SCORE capabilities require scoreValue'; END IF;
  ELSIF definition."valueKind" = 'COUNTER' THEN
    IF NEW."counterValue" IS NULL THEN RAISE EXCEPTION 'COUNTER capabilities require counterValue'; END IF;
  ELSIF definition."valueKind" = 'ENUM' THEN
    IF NEW."operation" <> 'SET' OR NEW."enumValue" IS NULL OR NOT (NEW."enumValue" = ANY(definition."enumValues")) THEN
      RAISE EXCEPTION 'ENUM capabilities require SET and a registered enumValue';
    END IF;
  ELSIF definition."valueKind" = 'REFERENCE' THEN
    IF NEW."operation" <> 'SET' OR NEW."referenceEntityType" IS NULL OR NEW."referenceEntityId" IS NULL
      OR NOT (NEW."referenceEntityType" = ANY(definition."allowedReferenceEntityTypes")) THEN
      RAISE EXCEPTION 'REFERENCE capabilities require SET and an allowed typed reference';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported CapabilityValueKind';
  END IF;

  IF definition."valueKind" IN ('SCORE', 'COUNTER') THEN
    FOR ordered_event IN
      SELECT * FROM (
        SELECT "capabilityEventId", "operation", "scoreValue", "counterValue", "occurredAt", "sequence"
        FROM "CapabilityEvent"
        WHERE "userId" = NEW."userId" AND "capabilityDefinitionId" = NEW."capabilityDefinitionId"
        UNION ALL
        SELECT NEW."capabilityEventId", NEW."operation", NEW."scoreValue", NEW."counterValue", NEW."occurredAt", NEW."sequence"
      ) timeline
      ORDER BY "occurredAt", "sequence", "capabilityEventId"
    LOOP
      IF definition."valueKind" = 'SCORE' THEN
        IF ordered_event."operation" = 'SET' THEN reduced_score := ordered_event."scoreValue";
        ELSE reduced_score := reduced_score + ordered_event."scoreValue"; END IF;
        IF (definition."minValue" IS NOT NULL AND reduced_score < definition."minValue")
          OR (definition."maxValue" IS NOT NULL AND reduced_score > definition."maxValue") THEN
          RAISE EXCEPTION 'Reduced SCORE is outside its authored range';
        END IF;
      ELSE
        IF ordered_event."operation" = 'SET' THEN reduced_counter := ordered_event."counterValue";
        ELSE reduced_counter := reduced_counter + ordered_event."counterValue"; END IF;
        IF (definition."minValue" IS NOT NULL AND reduced_counter < definition."minValue")
          OR (definition."maxValue" IS NOT NULL AND reduced_counter > definition."maxValue") THEN
          RAISE EXCEPTION 'Reduced COUNTER is outside its authored range';
        END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CapabilityEvent_validate"
BEFORE INSERT ON "CapabilityEvent"
FOR EACH ROW EXECUTE FUNCTION validate_capability_event();
