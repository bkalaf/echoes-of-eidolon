-- AlterTable
ALTER TABLE "CapabilityDefinition" RENAME COLUMN "valueType" TO "valueKind";
ALTER TABLE "CapabilityDefinition" ADD COLUMN "enumValues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "CapabilityDefinition" ADD CONSTRAINT "CapabilityDefinition_range_check"
CHECK (
  ("minValue" IS NULL OR "maxValue" IS NULL OR "minValue" <= "maxValue")
  AND (
    "valueKind" IN ('SCORE', 'COUNTER')
    OR ("minValue" IS NULL AND "maxValue" IS NULL)
  )
);

ALTER TABLE "CapabilityDefinition" ADD CONSTRAINT "CapabilityDefinition_enum_values_check"
CHECK (
  ("valueKind" = 'ENUM' AND cardinality("enumValues") > 0)
  OR ("valueKind" <> 'ENUM' AND cardinality("enumValues") = 0)
);

-- CreateTable
CREATE TABLE "CapabilityEvent" (
    "capabilityEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capabilityDefinitionId" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL,
    "operation" "CapabilityOperation" NOT NULL,
    "valueBoolean" BOOLEAN,
    "valueNumber" DOUBLE PRECISION,
    "valueToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapabilityEvent_pkey" PRIMARY KEY ("capabilityEventId")
);

ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_exactly_one_value_check"
CHECK (num_nonnulls("valueBoolean", "valueNumber", "valueToken") = 1);

ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_finite_number_check"
CHECK ("valueNumber" IS NULL OR "valueNumber" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8));

-- CreateIndex
CREATE UNIQUE INDEX "CapabilityEvent_userId_sequence_key" ON "CapabilityEvent"("userId", "sequence");

-- CreateIndex
CREATE INDEX "CapabilityEvent_capabilityDefinitionId_idx" ON "CapabilityEvent"("capabilityDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementDefinition_chainKey_rank_key" ON "AchievementDefinition"("chainKey", "rank");

-- AddForeignKey
ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapabilityEvent" ADD CONSTRAINT "CapabilityEvent_capabilityDefinitionId_fkey" FOREIGN KEY ("capabilityDefinitionId") REFERENCES "CapabilityDefinition"("capabilityDefinitionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The definition owns kind, operation, enum, and authored range validation.
CREATE OR REPLACE FUNCTION validate_capability_event()
RETURNS trigger AS $$
DECLARE
  definition "CapabilityDefinition"%ROWTYPE;
BEGIN
  SELECT * INTO definition
  FROM "CapabilityDefinition"
  WHERE "capabilityDefinitionId" = NEW."capabilityDefinitionId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown CapabilityDefinition';
  END IF;

  IF definition."valueKind" = 'BOOLEAN' THEN
    IF NEW."operation" <> 'SET' OR NEW."valueBoolean" IS NULL THEN
      RAISE EXCEPTION 'BOOLEAN capabilities require SET and a boolean value';
    END IF;
  ELSIF definition."valueKind" IN ('SCORE', 'COUNTER') THEN
    IF NEW."valueNumber" IS NULL THEN
      RAISE EXCEPTION 'Numeric capabilities require a numeric value';
    END IF;
    IF NEW."operation" = 'SET' AND (
      (definition."minValue" IS NOT NULL AND NEW."valueNumber" < definition."minValue")
      OR (definition."maxValue" IS NOT NULL AND NEW."valueNumber" > definition."maxValue")
    ) THEN
      RAISE EXCEPTION 'Capability SET value is outside its authored range';
    END IF;
  ELSIF definition."valueKind" = 'ENUM' THEN
    IF NEW."operation" <> 'SET' OR NEW."valueToken" IS NULL OR NOT (NEW."valueToken" = ANY(definition."enumValues")) THEN
      RAISE EXCEPTION 'ENUM capabilities require SET and a registered enum value';
    END IF;
  ELSIF definition."valueKind" = 'REFERENCE' THEN
    IF NEW."operation" <> 'SET' OR NEW."valueToken" IS NULL OR NEW."valueToken" = '' THEN
      RAISE EXCEPTION 'REFERENCE capabilities require SET and a nonempty reference value';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported CapabilityValueKind';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CapabilityEvent_validate"
BEFORE INSERT ON "CapabilityEvent"
FOR EACH ROW EXECUTE FUNCTION validate_capability_event();

CREATE OR REPLACE FUNCTION reject_capability_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CapabilityEvent history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CapabilityEvent_reject_update"
BEFORE UPDATE ON "CapabilityEvent"
FOR EACH ROW EXECUTE FUNCTION reject_capability_event_mutation();

CREATE TRIGGER "CapabilityEvent_reject_delete"
BEFORE DELETE ON "CapabilityEvent"
FOR EACH ROW EXECUTE FUNCTION reject_capability_event_mutation();
