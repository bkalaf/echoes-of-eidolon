-- Capability Ledger + Projection Architecture.
-- Historical capability migrations remain immutable. Legacy rows that lack
-- authoritative scope/address semantics stop this migration rather than being guessed.

CREATE TYPE "CapabilityParameterKind" AS ENUM ('ENTITY', 'STRING');
CREATE TYPE "CapabilityMonotonicPolicy" AS ENUM ('NONE', 'TRUE_ONLY', 'NONDECREASING', 'NONINCREASING');
CREATE TYPE "CapabilityDefinitionVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "CapabilityScopeType" AS ENUM ('ACCOUNT', 'PLAYTHROUGH', 'WORLD', 'PARTY', 'CHARACTER');
CREATE TYPE "ScoringPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "FactionStandingEvidenceKind" AS ENUM (
  'MINOR_HARM', 'MAJOR_HARM', 'MINOR_AID', 'MAJOR_AID',
  'PUBLIC_CENSURE', 'PRIVATE_CENSURE', 'PUBLIC_SUPPORT', 'PRIVATE_SUPPORT'
);

DO $$
DECLARE
  event_ids TEXT;
  disclosure_ids TEXT;
BEGIN
  SELECT string_agg("capabilityEventId", ', ' ORDER BY "capabilityEventId")
    INTO event_ids FROM "CapabilityEvent";
  IF event_ids IS NOT NULL THEN
    RAISE EXCEPTION 'CapabilityEvent rows require authoritative scope/address/version reconstruction before migration. Row identities: %', event_ids;
  END IF;

  SELECT string_agg("knowledgeBaseDisclosureId", ', ' ORDER BY "knowledgeBaseDisclosureId")
    INTO disclosure_ids FROM "KnowledgeBaseDisclosure";
  IF disclosure_ids IS NOT NULL THEN
    RAISE EXCEPTION 'KnowledgeBaseDisclosure rows require authoritative bound condition reconstruction before migration. Row identities: %', disclosure_ids;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS "CapabilityEvent_validate" ON "CapabilityEvent";
DROP TRIGGER IF EXISTS "CapabilityEvent_reject_update" ON "CapabilityEvent";
DROP TRIGGER IF EXISTS "CapabilityEvent_reject_delete" ON "CapabilityEvent";
DROP FUNCTION IF EXISTS validate_capability_event();
DROP FUNCTION IF EXISTS reject_capability_event_mutation();
DROP TABLE "CapabilityEvent";

DROP TRIGGER IF EXISTS "KnowledgeBaseDisclosure_validate" ON "KnowledgeBaseDisclosure";
DROP FUNCTION IF EXISTS validate_knowledge_base_disclosure();
ALTER TABLE "KnowledgeBaseDisclosure" DROP CONSTRAINT IF EXISTS "KnowledgeBaseDisclosure_requirement_value_check";
ALTER TABLE "KnowledgeBaseDisclosure" DROP CONSTRAINT IF EXISTS "KnowledgeBaseDisclosure_finite_number_check";
ALTER TABLE "KnowledgeBaseDisclosure" DROP CONSTRAINT IF EXISTS "KnowledgeBaseDisclosure_capabilityDefinitionId_fkey";
DROP INDEX IF EXISTS "KnowledgeBaseDisclosure_capabilityDefinitionId_idx";
ALTER TABLE "KnowledgeBaseDisclosure"
  DROP COLUMN "capabilityDefinitionId",
  DROP COLUMN "operator",
  DROP COLUMN "requiredBoolean",
  DROP COLUMN "requiredNumber",
  DROP COLUMN "requiredToken",
  ADD COLUMN "condition" JSONB NOT NULL;
ALTER TABLE "KnowledgeBaseDisclosure" ADD CONSTRAINT "KnowledgeBaseDisclosure_condition_object_check"
  CHECK (jsonb_typeof("condition") = 'object');

CREATE OR REPLACE FUNCTION validate_knowledge_base_disclosure_anchor()
RETURNS trigger AS $$
DECLARE anchor_item_id TEXT;
BEGIN
  IF NEW."anchorBlockId" IS NOT NULL THEN
    SELECT "knowledgeBaseItemId" INTO anchor_item_id FROM "KnowledgeBaseBlock"
      WHERE "knowledgeBaseBlockId" = NEW."anchorBlockId";
    IF anchor_item_id IS NULL OR anchor_item_id <> NEW."knowledgeBaseItemId" THEN
      RAISE EXCEPTION 'Knowledge disclosure anchor belongs to another entry';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "KnowledgeBaseDisclosure_validate_anchor"
BEFORE INSERT OR UPDATE ON "KnowledgeBaseDisclosure"
FOR EACH ROW EXECUTE FUNCTION validate_knowledge_base_disclosure_anchor();

ALTER TABLE "CapabilityDefinition" RENAME COLUMN "key" TO "code";
ALTER INDEX "CapabilityDefinition_key_key" RENAME TO "CapabilityDefinition_code_key";
ALTER TABLE "CapabilityDefinition" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "CapabilityDefinitionVersion" (
  "capabilityDefinitionVersionId" TEXT NOT NULL,
  "capabilityDefinitionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "pathPattern" TEXT NOT NULL,
  "valueKind" "CapabilityValueKind" NOT NULL,
  "minValue" DOUBLE PRECISION,
  "maxValue" DOUBLE PRECISION,
  "enumValues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowedReferenceEntityTypes" "EntityType"[] NOT NULL DEFAULT ARRAY[]::"EntityType"[],
  "allowedOperations" "CapabilityOperation"[] NOT NULL DEFAULT ARRAY[]::"CapabilityOperation"[],
  "monotonicPolicy" "CapabilityMonotonicPolicy" NOT NULL DEFAULT 'NONE',
  "initialBoolean" BOOLEAN,
  "initialScore" DOUBLE PRECISION,
  "initialCounter" BIGINT,
  "initialEnum" TEXT,
  "initialReferenceEntityType" "EntityType",
  "initialReferenceEntityId" TEXT,
  "description" TEXT NOT NULL,
  "status" "CapabilityDefinitionVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapabilityDefinitionVersion_pkey" PRIMARY KEY ("capabilityDefinitionVersionId")
);

INSERT INTO "CapabilityDefinitionVersion" (
  "capabilityDefinitionVersionId", "capabilityDefinitionId", "version", "pathPattern",
  "valueKind", "minValue", "maxValue", "enumValues", "allowedReferenceEntityTypes",
  "allowedOperations", "monotonicPolicy", "description", "status"
)
SELECT
  "capabilityDefinitionId" || ':v1', "capabilityDefinitionId", 1, "code",
  "valueKind", "minValue"::DOUBLE PRECISION, "maxValue"::DOUBLE PRECISION,
  "enumValues", "allowedReferenceEntityTypes",
  CASE WHEN "valueKind" IN ('SCORE', 'COUNTER')
    THEN ARRAY['SET', 'ADD']::"CapabilityOperation"[]
    ELSE ARRAY['SET']::"CapabilityOperation"[]
  END,
  'NONE', "description", 'ACTIVE'
FROM "CapabilityDefinition";

ALTER TABLE "CapabilityDefinition"
  DROP CONSTRAINT IF EXISTS "CapabilityDefinition_range_check",
  DROP CONSTRAINT IF EXISTS "CapabilityDefinition_enum_values_check",
  DROP CONSTRAINT IF EXISTS "CapabilityDefinition_reference_types_check",
  DROP COLUMN "valueKind",
  DROP COLUMN "minValue",
  DROP COLUMN "maxValue",
  DROP COLUMN "enumValues",
  DROP COLUMN "allowedReferenceEntityTypes",
  DROP COLUMN "description";

ALTER TABLE "CapabilityDefinitionVersion" ADD CONSTRAINT "CapabilityDefinitionVersion_capabilityDefinitionId_fkey"
  FOREIGN KEY ("capabilityDefinitionId") REFERENCES "CapabilityDefinition"("capabilityDefinitionId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "CapabilityDefinitionVersion_capabilityDefinitionId_version_key"
  ON "CapabilityDefinitionVersion"("capabilityDefinitionId", "version");
CREATE INDEX "CapabilityDefinitionVersion_capabilityDefinitionId_status_idx"
  ON "CapabilityDefinitionVersion"("capabilityDefinitionId", "status");
CREATE UNIQUE INDEX "CapabilityDefinitionVersion_one_active_per_definition"
  ON "CapabilityDefinitionVersion"("capabilityDefinitionId") WHERE "status" = 'ACTIVE';

CREATE TABLE "CapabilityParameterDefinition" (
  "capabilityParameterDefinitionId" TEXT NOT NULL,
  "capabilityDefinitionVersionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "CapabilityParameterKind" NOT NULL,
  "entityType" "EntityType",
  "allowedValues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ordinal" INTEGER NOT NULL,
  CONSTRAINT "CapabilityParameterDefinition_pkey" PRIMARY KEY ("capabilityParameterDefinitionId")
);
ALTER TABLE "CapabilityParameterDefinition" ADD CONSTRAINT "CapabilityParameter_version_fkey"
  FOREIGN KEY ("capabilityDefinitionVersionId") REFERENCES "CapabilityDefinitionVersion"("capabilityDefinitionVersionId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "CapabilityParameter_version_name_key"
  ON "CapabilityParameterDefinition"("capabilityDefinitionVersionId", "name");
CREATE UNIQUE INDEX "CapabilityParameter_version_ordinal_key"
  ON "CapabilityParameterDefinition"("capabilityDefinitionVersionId", "ordinal");

CREATE TABLE "CapabilityAddress" (
  "capabilityAddressId" TEXT NOT NULL,
  "capabilityDefinitionId" TEXT NOT NULL,
  "bindings" JSONB NOT NULL,
  "bindingsHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapabilityAddress_pkey" PRIMARY KEY ("capabilityAddressId")
);
ALTER TABLE "CapabilityAddress" ADD CONSTRAINT "CapabilityAddress_capabilityDefinitionId_fkey"
  FOREIGN KEY ("capabilityDefinitionId") REFERENCES "CapabilityDefinition"("capabilityDefinitionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityAddress" ADD CONSTRAINT "CapabilityAddress_bindings_object_check"
  CHECK (jsonb_typeof("bindings") = 'object' AND "bindingsHash" <> '');
CREATE UNIQUE INDEX "CapabilityAddress_capabilityDefinitionId_bindingsHash_key"
  ON "CapabilityAddress"("capabilityDefinitionId", "bindingsHash");
CREATE INDEX "CapabilityAddress_capabilityDefinitionId_idx" ON "CapabilityAddress"("capabilityDefinitionId");

CREATE TABLE "CapabilityEvent" (
  "capabilityEventId" TEXT NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "scopeType" "CapabilityScopeType" NOT NULL,
  "scopeId" TEXT NOT NULL,
  "capabilityAddressId" TEXT NOT NULL,
  "capabilityDefinitionVersionId" TEXT NOT NULL,
  "operation" "CapabilityOperation" NOT NULL,
  "booleanValue" BOOLEAN,
  "scoreValue" DOUBLE PRECISION,
  "counterValue" BIGINT,
  "enumValue" TEXT,
  "referenceEntityType" "EntityType",
  "referenceEntityId" TEXT,
  "sourceEntityType" "EntityType",
  "sourceEntityId" TEXT,
  "idempotencyKey" TEXT,
  "correlationId" TEXT,
  "causationId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapabilityEvent_pkey" PRIMARY KEY ("capabilityEventId")
);

CREATE TABLE "CapabilityState" (
  "scopeType" "CapabilityScopeType" NOT NULL,
  "scopeId" TEXT NOT NULL,
  "capabilityAddressId" TEXT NOT NULL,
  "capabilityDefinitionVersionId" TEXT NOT NULL,
  "isPresent" BOOLEAN NOT NULL DEFAULT false,
  "booleanValue" BOOLEAN,
  "scoreValue" DOUBLE PRECISION,
  "counterValue" BIGINT,
  "enumValue" TEXT,
  "referenceEntityType" "EntityType",
  "referenceEntityId" TEXT,
  "lastSequence" BIGINT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CapabilityState_pkey" PRIMARY KEY ("scopeType", "scopeId", "capabilityAddressId")
);

ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_capabilityAddressId_fkey"
  FOREIGN KEY ("capabilityAddressId") REFERENCES "CapabilityAddress"("capabilityAddressId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_capabilityDefinitionVersionId_fkey"
  FOREIGN KEY ("capabilityDefinitionVersionId") REFERENCES "CapabilityDefinitionVersion"("capabilityDefinitionVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityState" ADD CONSTRAINT "CapabilityState_capabilityAddressId_fkey"
  FOREIGN KEY ("capabilityAddressId") REFERENCES "CapabilityAddress"("capabilityAddressId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityState" ADD CONSTRAINT "CapabilityState_capabilityDefinitionVersionId_fkey"
  FOREIGN KEY ("capabilityDefinitionVersionId") REFERENCES "CapabilityDefinitionVersion"("capabilityDefinitionVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_typed_value_check" CHECK (
  ("operation" = 'CLEAR' AND num_nonnulls("booleanValue", "scoreValue", "counterValue", "enumValue", "referenceEntityType", "referenceEntityId") = 0)
  OR
  ("operation" IN ('SET', 'ADD') AND
    (CASE WHEN "booleanValue" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "scoreValue" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "counterValue" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "enumValue" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "referenceEntityType" IS NULL AND "referenceEntityId" IS NULL THEN 0 ELSE 1 END) = 1
    AND (("referenceEntityType" IS NULL) = ("referenceEntityId" IS NULL))
  )
);
ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_finite_score_check"
  CHECK ("scoreValue" IS NULL OR "scoreValue" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8));
ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_source_pair_check"
  CHECK (("sourceEntityType" IS NULL) = ("sourceEntityId" IS NULL));
ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_identity_text_check"
  CHECK ("scopeId" <> '' AND ("idempotencyKey" IS NULL OR "idempotencyKey" <> ''));
ALTER TABLE "CapabilityState" ADD CONSTRAINT "CapabilityState_typed_value_check" CHECK (
  (NOT "isPresent" AND num_nonnulls("booleanValue", "scoreValue", "counterValue", "enumValue", "referenceEntityType", "referenceEntityId") = 0)
  OR
  ("isPresent" AND
    (CASE WHEN "booleanValue" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "scoreValue" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "counterValue" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "enumValue" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "referenceEntityType" IS NULL AND "referenceEntityId" IS NULL THEN 0 ELSE 1 END) = 1
    AND (("referenceEntityType" IS NULL) = ("referenceEntityId" IS NULL))
  )
);
ALTER TABLE "CapabilityState" ADD CONSTRAINT "CapabilityState_finite_score_check"
  CHECK ("scoreValue" IS NULL OR "scoreValue" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8));

CREATE UNIQUE INDEX "CapabilityEvent_sequence_key" ON "CapabilityEvent"("sequence");
CREATE UNIQUE INDEX "CapabilityEvent_scope_address_idempotency_key"
  ON "CapabilityEvent"("scopeType", "scopeId", "capabilityAddressId", "idempotencyKey");
CREATE INDEX "CapabilityEvent_scopeType_scopeId_sequence_idx" ON "CapabilityEvent"("scopeType", "scopeId", "sequence");
CREATE INDEX "CapabilityEvent_capabilityAddressId_sequence_idx" ON "CapabilityEvent"("capabilityAddressId", "sequence");
CREATE INDEX "CapabilityEvent_capabilityDefinitionVersionId_idx" ON "CapabilityEvent"("capabilityDefinitionVersionId");
CREATE INDEX "CapabilityState_capabilityAddressId_idx" ON "CapabilityState"("capabilityAddressId");
CREATE INDEX "CapabilityState_lastSequence_idx" ON "CapabilityState"("lastSequence");

CREATE OR REPLACE FUNCTION validate_capability_definition_version()
RETURNS trigger AS $$
DECLARE
  initial_count INTEGER;
BEGIN
  IF NEW."version" < 1 OR NEW."pathPattern" = '' OR NEW."description" = '' THEN
    RAISE EXCEPTION 'Capability definition versions require positive version, pathPattern, and description';
  END IF;
  IF cardinality(NEW."allowedOperations") = 0 THEN
    RAISE EXCEPTION 'Capability definition versions require allowed operations';
  END IF;
  IF 'ADD' = ANY(NEW."allowedOperations") AND NEW."valueKind" NOT IN ('SCORE', 'COUNTER') THEN
    RAISE EXCEPTION 'ADD is legal only for SCORE and COUNTER';
  END IF;
  IF NEW."valueKind" = 'ENUM' AND cardinality(NEW."enumValues") = 0 THEN
    RAISE EXCEPTION 'ENUM definitions require authored values';
  ELSIF NEW."valueKind" <> 'ENUM' AND cardinality(NEW."enumValues") <> 0 THEN
    RAISE EXCEPTION 'Only ENUM definitions may own enum values';
  END IF;
  IF NEW."valueKind" = 'REFERENCE' AND cardinality(NEW."allowedReferenceEntityTypes") = 0 THEN
    RAISE EXCEPTION 'REFERENCE definitions require allowed entity types';
  ELSIF NEW."valueKind" <> 'REFERENCE' AND cardinality(NEW."allowedReferenceEntityTypes") <> 0 THEN
    RAISE EXCEPTION 'Only REFERENCE definitions may own reference entity types';
  END IF;
  IF NEW."valueKind" NOT IN ('SCORE', 'COUNTER') AND (NEW."minValue" IS NOT NULL OR NEW."maxValue" IS NOT NULL) THEN
    RAISE EXCEPTION 'Only numeric definitions may own bounds';
  END IF;
  IF NEW."minValue" IS NOT NULL AND NEW."maxValue" IS NOT NULL AND NEW."minValue" > NEW."maxValue" THEN
    RAISE EXCEPTION 'Capability minimum exceeds maximum';
  END IF;
  IF NEW."minValue" IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8)
    OR NEW."maxValue" IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8)
    OR NEW."initialScore" IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8) THEN
    RAISE EXCEPTION 'Capability numeric configuration must be finite';
  END IF;
  IF (NEW."initialReferenceEntityType" IS NULL) <> (NEW."initialReferenceEntityId" IS NULL) THEN
    RAISE EXCEPTION 'Capability initial reference requires both fields';
  END IF;
  initial_count := num_nonnulls(NEW."initialBoolean", NEW."initialScore", NEW."initialCounter", NEW."initialEnum")
    + CASE WHEN NEW."initialReferenceEntityType" IS NULL THEN 0 ELSE 1 END;
  IF initial_count > 1 THEN RAISE EXCEPTION 'Capability has multiple initial values'; END IF;
  IF initial_count = 1 AND NOT (
    (NEW."valueKind" = 'BOOLEAN' AND NEW."initialBoolean" IS NOT NULL)
    OR (NEW."valueKind" = 'SCORE' AND NEW."initialScore" IS NOT NULL)
    OR (NEW."valueKind" = 'COUNTER' AND NEW."initialCounter" IS NOT NULL)
    OR (NEW."valueKind" = 'ENUM' AND NEW."initialEnum" = ANY(NEW."enumValues"))
    OR (NEW."valueKind" = 'REFERENCE' AND NEW."initialReferenceEntityType" = ANY(NEW."allowedReferenceEntityTypes"))
  ) THEN RAISE EXCEPTION 'Capability initial value does not match its definition'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CapabilityDefinitionVersion_validate"
BEFORE INSERT OR UPDATE ON "CapabilityDefinitionVersion"
FOR EACH ROW EXECUTE FUNCTION validate_capability_definition_version();

CREATE OR REPLACE FUNCTION protect_capability_definition_version()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' OR EXISTS (
      SELECT 1 FROM "CapabilityEvent" WHERE "capabilityDefinitionVersionId" = OLD."capabilityDefinitionVersionId"
    ) THEN RAISE EXCEPTION 'Used or published capability definition versions are immutable'; END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" <> 'DRAFT' OR EXISTS (
    SELECT 1 FROM "CapabilityEvent" WHERE "capabilityDefinitionVersionId" = OLD."capabilityDefinitionVersionId"
  ) THEN
    IF NOT (OLD."status" = 'ACTIVE' AND NEW."status" = 'RETIRED'
      AND (to_jsonb(OLD) - 'status') = (to_jsonb(NEW) - 'status')) THEN
      RAISE EXCEPTION 'Used or published capability definition versions are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CapabilityDefinitionVersion_protect"
BEFORE UPDATE OR DELETE ON "CapabilityDefinitionVersion"
FOR EACH ROW EXECUTE FUNCTION protect_capability_definition_version();

CREATE OR REPLACE FUNCTION validate_capability_parameter()
RETURNS trigger AS $$
BEGIN
  IF NEW."name" !~ '^[A-Z][A-Z0-9_]*$' OR NEW."ordinal" < 0 THEN
    RAISE EXCEPTION 'Capability parameter name or ordinal is invalid';
  END IF;
  IF NEW."kind" = 'ENTITY' AND (NEW."entityType" IS NULL OR cardinality(NEW."allowedValues") <> 0) THEN
    RAISE EXCEPTION 'ENTITY parameters require entityType and no string values';
  ELSIF NEW."kind" = 'STRING' AND (NEW."entityType" IS NOT NULL OR cardinality(NEW."allowedValues") = 0) THEN
    RAISE EXCEPTION 'STRING parameters require allowed values and no entityType';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "CapabilityParameterDefinition_validate"
BEFORE INSERT OR UPDATE ON "CapabilityParameterDefinition"
FOR EACH ROW EXECUTE FUNCTION validate_capability_parameter();

CREATE OR REPLACE FUNCTION validate_and_project_capability_event()
RETURNS trigger AS $$
DECLARE
  definition_version "CapabilityDefinitionVersion"%ROWTYPE;
  address_definition_id TEXT;
  current_state "CapabilityState"%ROWTYPE;
  previous_score DOUBLE PRECISION;
  previous_counter BIGINT;
  result_score DOUBLE PRECISION;
  result_counter BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."scopeType"::TEXT || ':' || NEW."scopeId" || ':' || NEW."capabilityAddressId", 0));

  SELECT * INTO definition_version FROM "CapabilityDefinitionVersion"
    WHERE "capabilityDefinitionVersionId" = NEW."capabilityDefinitionVersionId";
  IF NOT FOUND OR definition_version."status" = 'DRAFT' THEN
    RAISE EXCEPTION 'CapabilityEvent requires a published definition version';
  END IF;
  SELECT "capabilityDefinitionId" INTO address_definition_id FROM "CapabilityAddress"
    WHERE "capabilityAddressId" = NEW."capabilityAddressId";
  IF address_definition_id IS NULL OR address_definition_id <> definition_version."capabilityDefinitionId" THEN
    RAISE EXCEPTION 'CapabilityEvent address and definition version do not share a stable definition';
  END IF;
  IF NOT (NEW."operation" = ANY(definition_version."allowedOperations")) THEN
    RAISE EXCEPTION 'Capability operation is not allowed by this definition version';
  END IF;
  IF NEW."operation" <> 'CLEAR' THEN
    IF definition_version."valueKind" = 'BOOLEAN' AND NEW."booleanValue" IS NULL THEN
      RAISE EXCEPTION 'BOOLEAN capability requires booleanValue';
    ELSIF definition_version."valueKind" = 'SCORE' AND NEW."scoreValue" IS NULL THEN
      RAISE EXCEPTION 'SCORE capability requires scoreValue';
    ELSIF definition_version."valueKind" = 'COUNTER' AND NEW."counterValue" IS NULL THEN
      RAISE EXCEPTION 'COUNTER capability requires counterValue';
    ELSIF definition_version."valueKind" = 'ENUM'
      AND (NEW."enumValue" IS NULL OR NOT (NEW."enumValue" = ANY(definition_version."enumValues"))) THEN
      RAISE EXCEPTION 'ENUM capability requires an authored enumValue';
    ELSIF definition_version."valueKind" = 'REFERENCE'
      AND (NEW."referenceEntityType" IS NULL OR NEW."referenceEntityId" = ''
        OR NOT (NEW."referenceEntityType" = ANY(definition_version."allowedReferenceEntityTypes"))) THEN
      RAISE EXCEPTION 'REFERENCE capability requires an allowed typed reference';
    END IF;
  END IF;

  SELECT * INTO current_state FROM "CapabilityState"
    WHERE "scopeType" = NEW."scopeType" AND "scopeId" = NEW."scopeId"
      AND "capabilityAddressId" = NEW."capabilityAddressId" FOR UPDATE;

  IF NEW."operation" = 'ADD' THEN
    IF definition_version."valueKind" = 'SCORE' THEN
      previous_score := CASE WHEN FOUND AND current_state."isPresent" THEN current_state."scoreValue"
        ELSE COALESCE(definition_version."initialScore", 0) END;
      result_score := previous_score + NEW."scoreValue";
      NEW."scoreValue" := NEW."scoreValue";
    ELSE
      previous_counter := CASE WHEN FOUND AND current_state."isPresent" THEN current_state."counterValue"
        ELSE COALESCE(definition_version."initialCounter", 0) END;
      result_counter := previous_counter + NEW."counterValue";
    END IF;
  ELSE
    result_score := NEW."scoreValue";
    result_counter := NEW."counterValue";
  END IF;

  IF NEW."operation" <> 'CLEAR' AND definition_version."valueKind" = 'SCORE' AND (
    (definition_version."minValue" IS NOT NULL AND result_score < definition_version."minValue")
    OR (definition_version."maxValue" IS NOT NULL AND result_score > definition_version."maxValue")
  ) THEN RAISE EXCEPTION 'Projected SCORE is outside its authored range'; END IF;
  IF NEW."operation" <> 'CLEAR' AND definition_version."valueKind" = 'COUNTER' AND (
    (definition_version."minValue" IS NOT NULL AND result_counter < definition_version."minValue")
    OR (definition_version."maxValue" IS NOT NULL AND result_counter > definition_version."maxValue")
  ) THEN RAISE EXCEPTION 'Projected COUNTER is outside its authored range'; END IF;

  IF NEW."operation" <> 'CLEAR' AND definition_version."monotonicPolicy" = 'TRUE_ONLY'
    AND NEW."booleanValue" IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'TRUE_ONLY capability cannot become false';
  END IF;
  IF FOUND AND current_state."isPresent" AND NEW."operation" <> 'CLEAR'
    AND definition_version."monotonicPolicy" = 'NONDECREASING' AND (
      (definition_version."valueKind" = 'SCORE' AND result_score < current_state."scoreValue")
      OR (definition_version."valueKind" = 'COUNTER' AND result_counter < current_state."counterValue")
    ) THEN RAISE EXCEPTION 'NONDECREASING capability cannot decrease'; END IF;
  IF FOUND AND current_state."isPresent" AND NEW."operation" <> 'CLEAR'
    AND definition_version."monotonicPolicy" = 'NONINCREASING' AND (
      (definition_version."valueKind" = 'SCORE' AND result_score > current_state."scoreValue")
      OR (definition_version."valueKind" = 'COUNTER' AND result_counter > current_state."counterValue")
    ) THEN RAISE EXCEPTION 'NONINCREASING capability cannot increase'; END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CapabilityEvent_validate"
BEFORE INSERT ON "CapabilityEvent"
FOR EACH ROW EXECUTE FUNCTION validate_and_project_capability_event();

CREATE OR REPLACE FUNCTION project_capability_event()
RETURNS trigger AS $$
DECLARE
  definition_version "CapabilityDefinitionVersion"%ROWTYPE;
  old_state "CapabilityState"%ROWTYPE;
  projected_score DOUBLE PRECISION;
  projected_counter BIGINT;
BEGIN
  SELECT * INTO definition_version FROM "CapabilityDefinitionVersion"
    WHERE "capabilityDefinitionVersionId" = NEW."capabilityDefinitionVersionId";
  SELECT * INTO old_state FROM "CapabilityState"
    WHERE "scopeType" = NEW."scopeType" AND "scopeId" = NEW."scopeId"
      AND "capabilityAddressId" = NEW."capabilityAddressId";

  projected_score := CASE WHEN NEW."operation" = 'ADD'
    THEN COALESCE(CASE WHEN old_state."isPresent" THEN old_state."scoreValue" END, definition_version."initialScore", 0) + NEW."scoreValue"
    ELSE NEW."scoreValue" END;
  projected_counter := CASE WHEN NEW."operation" = 'ADD'
    THEN COALESCE(CASE WHEN old_state."isPresent" THEN old_state."counterValue" END, definition_version."initialCounter", 0) + NEW."counterValue"
    ELSE NEW."counterValue" END;

  INSERT INTO "CapabilityState" (
    "scopeType", "scopeId", "capabilityAddressId", "capabilityDefinitionVersionId",
    "isPresent", "booleanValue", "scoreValue", "counterValue", "enumValue",
    "referenceEntityType", "referenceEntityId", "lastSequence", "updatedAt"
  ) VALUES (
    NEW."scopeType", NEW."scopeId", NEW."capabilityAddressId", NEW."capabilityDefinitionVersionId",
    NEW."operation" <> 'CLEAR',
    CASE WHEN NEW."operation" = 'CLEAR' THEN NULL ELSE NEW."booleanValue" END,
    CASE WHEN NEW."operation" = 'CLEAR' THEN NULL ELSE projected_score END,
    CASE WHEN NEW."operation" = 'CLEAR' THEN NULL ELSE projected_counter END,
    CASE WHEN NEW."operation" = 'CLEAR' THEN NULL ELSE NEW."enumValue" END,
    CASE WHEN NEW."operation" = 'CLEAR' THEN NULL ELSE NEW."referenceEntityType" END,
    CASE WHEN NEW."operation" = 'CLEAR' THEN NULL ELSE NEW."referenceEntityId" END,
    NEW."sequence", CURRENT_TIMESTAMP
  )
  ON CONFLICT ("scopeType", "scopeId", "capabilityAddressId") DO UPDATE SET
    "capabilityDefinitionVersionId" = EXCLUDED."capabilityDefinitionVersionId",
    "isPresent" = EXCLUDED."isPresent",
    "booleanValue" = EXCLUDED."booleanValue",
    "scoreValue" = EXCLUDED."scoreValue",
    "counterValue" = EXCLUDED."counterValue",
    "enumValue" = EXCLUDED."enumValue",
    "referenceEntityType" = EXCLUDED."referenceEntityType",
    "referenceEntityId" = EXCLUDED."referenceEntityId",
    "lastSequence" = EXCLUDED."lastSequence",
    "updatedAt" = EXCLUDED."updatedAt";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CapabilityEvent_project"
AFTER INSERT ON "CapabilityEvent"
FOR EACH ROW EXECUTE FUNCTION project_capability_event();

CREATE OR REPLACE FUNCTION reject_capability_event_mutation()
RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'CapabilityEvent history is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "CapabilityEvent_reject_update" BEFORE UPDATE ON "CapabilityEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_capability_event_mutation();
CREATE TRIGGER "CapabilityEvent_reject_delete" BEFORE DELETE ON "CapabilityEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_capability_event_mutation();

CREATE TABLE "RewardScoringPolicy" (
  "rewardScoringPolicyId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ScoringPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "minimumScore" DOUBLE PRECISION NOT NULL,
  "maximumScore" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardScoringPolicy_pkey" PRIMARY KEY ("rewardScoringPolicyId")
);
CREATE UNIQUE INDEX "RewardScoringPolicy_version_key" ON "RewardScoringPolicy"("version");
CREATE UNIQUE INDEX "RewardScoringPolicy_one_active" ON "RewardScoringPolicy"((1)) WHERE "status" = 'ACTIVE';
ALTER TABLE "RewardScoringPolicy" ADD CONSTRAINT "RewardScoringPolicy_range_check" CHECK (
  "version" > 0 AND "minimumScore" <= "maximumScore"
  AND "minimumScore" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8)
  AND "maximumScore" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8)
);

CREATE TABLE "RewardScoringWeight" (
  "rewardScoringPolicyId" TEXT NOT NULL,
  "kind" "RewardEvidenceKind" NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "RewardScoringWeight_pkey" PRIMARY KEY ("rewardScoringPolicyId", "kind")
);
ALTER TABLE "RewardScoringWeight" ADD CONSTRAINT "RewardScoringWeight_rewardScoringPolicyId_fkey"
  FOREIGN KEY ("rewardScoringPolicyId") REFERENCES "RewardScoringPolicy"("rewardScoringPolicyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardScoringWeight" ADD CONSTRAINT "RewardScoringWeight_finite_check"
  CHECK ("weight" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8));

CREATE TABLE "RewardCandidate" (
  "rewardCandidateId" TEXT NOT NULL,
  "legendaryRewardId" TEXT NOT NULL,
  "candidateKey" TEXT NOT NULL,
  "scoreCeiling" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "RewardCandidate_pkey" PRIMARY KEY ("rewardCandidateId")
);
ALTER TABLE "RewardCandidate" ADD CONSTRAINT "RewardCandidate_legendaryRewardId_fkey"
  FOREIGN KEY ("legendaryRewardId") REFERENCES "LegendaryReward"("legendaryRewardId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardCandidate" ADD CONSTRAINT "RewardCandidate_ceiling_check"
  CHECK ("candidateKey" <> '' AND "scoreCeiling" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8));
CREATE UNIQUE INDEX "RewardCandidate_legendaryRewardId_candidateKey_key"
  ON "RewardCandidate"("legendaryRewardId", "candidateKey");
CREATE INDEX "RewardCandidate_legendaryRewardId_idx" ON "RewardCandidate"("legendaryRewardId");

CREATE TABLE "RewardEvidenceEvent" (
  "rewardEvidenceEventId" TEXT NOT NULL,
  "scopeType" "CapabilityScopeType" NOT NULL,
  "scopeId" TEXT NOT NULL,
  "legendaryRewardId" TEXT NOT NULL,
  "rewardCandidateId" TEXT NOT NULL,
  "kind" "RewardEvidenceKind" NOT NULL,
  "sourceEntityType" "EntityType",
  "sourceEntityId" TEXT,
  "evidenceId" TEXT NOT NULL,
  "scoringPolicyVersion" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardEvidenceEvent_pkey" PRIMARY KEY ("rewardEvidenceEventId")
);
ALTER TABLE "RewardEvidenceEvent" ADD CONSTRAINT "RewardEvidenceEvent_rewardCandidateId_fkey"
  FOREIGN KEY ("rewardCandidateId") REFERENCES "RewardCandidate"("rewardCandidateId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardEvidenceEvent" ADD CONSTRAINT "RewardEvidenceEvent_scoringPolicyVersion_fkey"
  FOREIGN KEY ("scoringPolicyVersion") REFERENCES "RewardScoringPolicy"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardEvidenceEvent" ADD CONSTRAINT "RewardEvidenceEvent_source_pair_check"
  CHECK (("sourceEntityType" IS NULL) = ("sourceEntityId" IS NULL));
ALTER TABLE "RewardEvidenceEvent" ADD CONSTRAINT "RewardEvidenceEvent_identity_check"
  CHECK ("scopeId" <> '' AND "evidenceId" <> '');
CREATE UNIQUE INDEX "RewardEvidence_scope_candidate_evidence_key"
  ON "RewardEvidenceEvent"("scopeType", "scopeId", "rewardCandidateId", "evidenceId");
CREATE INDEX "RewardEvidenceEvent_legendaryRewardId_rewardCandidateId_idx"
  ON "RewardEvidenceEvent"("legendaryRewardId", "rewardCandidateId");
CREATE INDEX "RewardEvidenceEvent_scoringPolicyVersion_idx" ON "RewardEvidenceEvent"("scoringPolicyVersion");

CREATE OR REPLACE FUNCTION validate_reward_evidence_event()
RETURNS trigger AS $$
DECLARE candidate_reward_id TEXT;
BEGIN
  SELECT "legendaryRewardId" INTO candidate_reward_id FROM "RewardCandidate"
    WHERE "rewardCandidateId" = NEW."rewardCandidateId";
  IF candidate_reward_id IS NULL OR candidate_reward_id <> NEW."legendaryRewardId" THEN
    RAISE EXCEPTION 'Reward evidence candidate belongs to another LegendaryReward';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "RewardEvidenceEvent_validate"
BEFORE INSERT ON "RewardEvidenceEvent"
FOR EACH ROW EXECUTE FUNCTION validate_reward_evidence_event();

CREATE TABLE "FactionStandingScoringPolicy" (
  "factionStandingScoringPolicyId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ScoringPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "minimumScore" DOUBLE PRECISION NOT NULL,
  "maximumScore" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FactionStandingScoringPolicy_pkey" PRIMARY KEY ("factionStandingScoringPolicyId")
);
CREATE UNIQUE INDEX "FactionStandingScoringPolicy_version_key" ON "FactionStandingScoringPolicy"("version");
CREATE UNIQUE INDEX "FactionStandingScoringPolicy_one_active" ON "FactionStandingScoringPolicy"((1)) WHERE "status" = 'ACTIVE';
ALTER TABLE "FactionStandingScoringPolicy" ADD CONSTRAINT "FactionStandingScoringPolicy_range_check" CHECK (
  "version" > 0 AND "minimumScore" <= "maximumScore"
  AND "minimumScore" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8)
  AND "maximumScore" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8)
);

CREATE TABLE "FactionStandingScoringWeight" (
  "factionStandingScoringPolicyId" TEXT NOT NULL,
  "kind" "FactionStandingEvidenceKind" NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "FactionStandingScoringWeight_pkey" PRIMARY KEY ("factionStandingScoringPolicyId", "kind")
);
ALTER TABLE "FactionStandingScoringWeight" ADD CONSTRAINT "FactionWeight_policy_fkey"
  FOREIGN KEY ("factionStandingScoringPolicyId") REFERENCES "FactionStandingScoringPolicy"("factionStandingScoringPolicyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FactionStandingScoringWeight" ADD CONSTRAINT "FactionStandingScoringWeight_finite_check"
  CHECK ("weight" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8));

CREATE TABLE "FactionStandingEvidenceEvent" (
  "factionStandingEvidenceEventId" TEXT NOT NULL,
  "scopeType" "CapabilityScopeType" NOT NULL,
  "scopeId" TEXT NOT NULL,
  "factionId" TEXT NOT NULL,
  "kind" "FactionStandingEvidenceKind" NOT NULL,
  "sourceEntityType" "EntityType",
  "sourceEntityId" TEXT,
  "evidenceId" TEXT NOT NULL,
  "scoringPolicyVersion" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FactionStandingEvidenceEvent_pkey" PRIMARY KEY ("factionStandingEvidenceEventId")
);
ALTER TABLE "FactionStandingEvidenceEvent" ADD CONSTRAINT "FactionStandingEvidenceEvent_scoringPolicyVersion_fkey"
  FOREIGN KEY ("scoringPolicyVersion") REFERENCES "FactionStandingScoringPolicy"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FactionStandingEvidenceEvent" ADD CONSTRAINT "FactionStandingEvidenceEvent_source_pair_check"
  CHECK (("sourceEntityType" IS NULL) = ("sourceEntityId" IS NULL));
ALTER TABLE "FactionStandingEvidenceEvent" ADD CONSTRAINT "FactionStandingEvidenceEvent_identity_check"
  CHECK ("scopeId" <> '' AND "factionId" <> '' AND "evidenceId" <> '');
CREATE UNIQUE INDEX "FactionEvidence_scope_faction_evidence_key"
  ON "FactionStandingEvidenceEvent"("scopeType", "scopeId", "factionId", "evidenceId");
CREATE INDEX "FactionStandingEvidenceEvent_factionId_idx" ON "FactionStandingEvidenceEvent"("factionId");
CREATE INDEX "FactionStandingEvidenceEvent_scoringPolicyVersion_idx" ON "FactionStandingEvidenceEvent"("scoringPolicyVersion");

CREATE OR REPLACE FUNCTION reject_semantic_evidence_mutation()
RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Semantic evidence history is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "RewardEvidenceEvent_reject_update" BEFORE UPDATE ON "RewardEvidenceEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_semantic_evidence_mutation();
CREATE TRIGGER "RewardEvidenceEvent_reject_delete" BEFORE DELETE ON "RewardEvidenceEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_semantic_evidence_mutation();
CREATE TRIGGER "FactionStandingEvidenceEvent_reject_update" BEFORE UPDATE ON "FactionStandingEvidenceEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_semantic_evidence_mutation();
CREATE TRIGGER "FactionStandingEvidenceEvent_reject_delete" BEFORE DELETE ON "FactionStandingEvidenceEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_semantic_evidence_mutation();

CREATE OR REPLACE FUNCTION protect_scoring_policy()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN RAISE EXCEPTION 'Published scoring policy versions are immutable'; END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" <> 'DRAFT' AND NOT (
    OLD."status" = 'ACTIVE' AND NEW."status" = 'RETIRED'
    AND (to_jsonb(OLD) - 'status') = (to_jsonb(NEW) - 'status')
  ) THEN RAISE EXCEPTION 'Published scoring policy versions are immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "RewardScoringPolicy_protect" BEFORE UPDATE OR DELETE ON "RewardScoringPolicy"
  FOR EACH ROW EXECUTE FUNCTION protect_scoring_policy();
CREATE TRIGGER "FactionStandingScoringPolicy_protect" BEFORE UPDATE OR DELETE ON "FactionStandingScoringPolicy"
  FOR EACH ROW EXECUTE FUNCTION protect_scoring_policy();

CREATE OR REPLACE FUNCTION protect_scoring_weight()
RETURNS trigger AS $$
DECLARE policy_status "ScoringPolicyStatus";
BEGIN
  IF TG_TABLE_NAME = 'RewardScoringWeight' THEN
    SELECT "status" INTO policy_status FROM "RewardScoringPolicy"
      WHERE "rewardScoringPolicyId" = COALESCE(NEW."rewardScoringPolicyId", OLD."rewardScoringPolicyId");
  ELSE
    SELECT "status" INTO policy_status FROM "FactionStandingScoringPolicy"
      WHERE "factionStandingScoringPolicyId" = COALESCE(NEW."factionStandingScoringPolicyId", OLD."factionStandingScoringPolicyId");
  END IF;
  IF policy_status <> 'DRAFT' THEN RAISE EXCEPTION 'Published scoring policy weights are immutable'; END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "RewardScoringWeight_protect" BEFORE INSERT OR UPDATE OR DELETE ON "RewardScoringWeight"
  FOR EACH ROW EXECUTE FUNCTION protect_scoring_weight();
CREATE TRIGGER "FactionStandingScoringWeight_protect" BEFORE INSERT OR UPDATE OR DELETE ON "FactionStandingScoringWeight"
  FOR EACH ROW EXECUTE FUNCTION protect_scoring_weight();

CREATE OR REPLACE FUNCTION validate_scoring_policy_activation()
RETURNS trigger AS $$
DECLARE weight_count INTEGER;
BEGIN
  IF NEW."status" = 'ACTIVE' AND OLD."status" <> 'ACTIVE' THEN
    IF TG_TABLE_NAME = 'RewardScoringPolicy' THEN
      SELECT count(*) INTO weight_count FROM "RewardScoringWeight"
        WHERE "rewardScoringPolicyId" = NEW."rewardScoringPolicyId";
      IF weight_count <> 6 THEN RAISE EXCEPTION 'Active reward scoring policy requires all six semantic weights'; END IF;
    ELSE
      SELECT count(*) INTO weight_count FROM "FactionStandingScoringWeight"
        WHERE "factionStandingScoringPolicyId" = NEW."factionStandingScoringPolicyId";
      IF weight_count <> 8 THEN RAISE EXCEPTION 'Active faction scoring policy requires all eight semantic weights'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "RewardScoringPolicy_validate_activation"
BEFORE UPDATE ON "RewardScoringPolicy"
FOR EACH ROW EXECUTE FUNCTION validate_scoring_policy_activation();
CREATE TRIGGER "FactionStandingScoringPolicy_validate_activation"
BEFORE UPDATE ON "FactionStandingScoringPolicy"
FOR EACH ROW EXECUTE FUNCTION validate_scoring_policy_activation();

-- The six reward weights are the only owner-authorized scoring data in this migration.
INSERT INTO "RewardScoringPolicy" (
  "rewardScoringPolicyId", "version", "status", "minimumScore", "maximumScore"
) VALUES ('REWARD-POLICY-V1', 1, 'DRAFT', 0, 1000);
INSERT INTO "RewardScoringWeight" ("rewardScoringPolicyId", "kind", "weight") VALUES
  ('REWARD-POLICY-V1', 'RUMOR', 50),
  ('REWARD-POLICY-V1', 'EVIDENCE', 100),
  ('REWARD-POLICY-V1', 'PROOF', 200),
  ('REWARD-POLICY-V1', 'DOUBT', -50),
  ('REWARD-POLICY-V1', 'CONTRADICTION', -100),
  ('REWARD-POLICY-V1', 'REFUTATION', -200);
UPDATE "RewardScoringPolicy" SET "status" = 'ACTIVE' WHERE "rewardScoringPolicyId" = 'REWARD-POLICY-V1';

-- No faction standing weights are owner-authorized; no active policy is seeded.
