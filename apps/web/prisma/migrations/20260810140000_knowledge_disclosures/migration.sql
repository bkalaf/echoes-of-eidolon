-- CreateTable
CREATE TABLE "KnowledgeBaseBlock" (
    "knowledgeBaseBlockId" TEXT NOT NULL,
    "knowledgeBaseItemId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "kind" "KnowledgeBaseBlockKind" NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "KnowledgeBaseBlock_pkey" PRIMARY KEY ("knowledgeBaseBlockId")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseDisclosure" (
    "knowledgeBaseDisclosureId" TEXT NOT NULL,
    "knowledgeBaseItemId" TEXT NOT NULL,
    "capabilityDefinitionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "operator" "CapabilityRequirementOperator" NOT NULL,
    "requiredBoolean" BOOLEAN,
    "requiredNumber" DOUBLE PRECISION,
    "requiredToken" TEXT,
    "mode" "KnowledgeBaseDisclosureMode" NOT NULL,
    "anchorBlockId" TEXT,

    CONSTRAINT "KnowledgeBaseDisclosure_pkey" PRIMARY KEY ("knowledgeBaseDisclosureId")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseDisclosureBlock" (
    "knowledgeBaseDisclosureBlockId" TEXT NOT NULL,
    "knowledgeBaseDisclosureId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "kind" "KnowledgeBaseBlockKind" NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "KnowledgeBaseDisclosureBlock_pkey" PRIMARY KEY ("knowledgeBaseDisclosureBlockId")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseDisclosureCitation" (
    "knowledgeBaseDisclosureId" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,
    "firstUseOrder" INTEGER NOT NULL,

    CONSTRAINT "KnowledgeBaseDisclosureCitation_pkey" PRIMARY KEY ("knowledgeBaseDisclosureId", "citationId")
);

ALTER TABLE "KnowledgeBaseDisclosure" ADD CONSTRAINT "KnowledgeBaseDisclosure_requirement_value_check"
CHECK (
  ("operator" = 'EXISTS' AND num_nonnulls("requiredBoolean", "requiredNumber", "requiredToken") = 0)
  OR ("operator" IN ('EQ', 'NEQ') AND num_nonnulls("requiredBoolean", "requiredNumber", "requiredToken") = 1)
  OR ("operator" IN ('GT', 'GTE', 'LT', 'LTE') AND "requiredNumber" IS NOT NULL AND num_nonnulls("requiredBoolean", "requiredToken") = 0)
);

ALTER TABLE "KnowledgeBaseDisclosure" ADD CONSTRAINT "KnowledgeBaseDisclosure_anchor_check"
CHECK (
  ("mode" IN ('APPEND_BLOCKS', 'REPLACE_ENTRY') AND "anchorBlockId" IS NULL)
  OR ("mode" IN ('INSERT_AFTER_BLOCK', 'REPLACE_BLOCK') AND "anchorBlockId" IS NOT NULL)
);

ALTER TABLE "KnowledgeBaseDisclosure" ADD CONSTRAINT "KnowledgeBaseDisclosure_finite_number_check"
CHECK ("requiredNumber" IS NULL OR "requiredNumber" NOT IN ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8));

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBaseBlock_knowledgeBaseItemId_ordinal_key" ON "KnowledgeBaseBlock"("knowledgeBaseItemId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBaseDisclosure_knowledgeBaseItemId_ordinal_key" ON "KnowledgeBaseDisclosure"("knowledgeBaseItemId", "ordinal");

-- CreateIndex
CREATE INDEX "KnowledgeBaseDisclosure_capabilityDefinitionId_idx" ON "KnowledgeBaseDisclosure"("capabilityDefinitionId");

-- CreateIndex
CREATE INDEX "KnowledgeBaseDisclosure_anchorBlockId_idx" ON "KnowledgeBaseDisclosure"("anchorBlockId");

-- CreateIndex
CREATE UNIQUE INDEX "KBDisclosureBlock_disclosure_ordinal_key" ON "KnowledgeBaseDisclosureBlock"("knowledgeBaseDisclosureId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "KBDisclosureCitation_disclosure_order_key" ON "KnowledgeBaseDisclosureCitation"("knowledgeBaseDisclosureId", "firstUseOrder");

-- CreateIndex
CREATE INDEX "KnowledgeBaseDisclosureCitation_citationId_idx" ON "KnowledgeBaseDisclosureCitation"("citationId");

-- AddForeignKey
ALTER TABLE "KnowledgeBaseBlock" ADD CONSTRAINT "KnowledgeBaseBlock_knowledgeBaseItemId_fkey" FOREIGN KEY ("knowledgeBaseItemId") REFERENCES "KnowledgeBaseItem"("knowledgeBaseItemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseDisclosure" ADD CONSTRAINT "KnowledgeBaseDisclosure_knowledgeBaseItemId_fkey" FOREIGN KEY ("knowledgeBaseItemId") REFERENCES "KnowledgeBaseItem"("knowledgeBaseItemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseDisclosure" ADD CONSTRAINT "KnowledgeBaseDisclosure_capabilityDefinitionId_fkey" FOREIGN KEY ("capabilityDefinitionId") REFERENCES "CapabilityDefinition"("capabilityDefinitionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseDisclosure" ADD CONSTRAINT "KnowledgeBaseDisclosure_anchorBlockId_fkey" FOREIGN KEY ("anchorBlockId") REFERENCES "KnowledgeBaseBlock"("knowledgeBaseBlockId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseDisclosureBlock" ADD CONSTRAINT "KnowledgeBaseDisclosureBlock_knowledgeBaseDisclosureId_fkey" FOREIGN KEY ("knowledgeBaseDisclosureId") REFERENCES "KnowledgeBaseDisclosure"("knowledgeBaseDisclosureId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseDisclosureCitation" ADD CONSTRAINT "KnowledgeBaseDisclosureCitation_knowledgeBaseDisclosureId_fkey" FOREIGN KEY ("knowledgeBaseDisclosureId") REFERENCES "KnowledgeBaseDisclosure"("knowledgeBaseDisclosureId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseDisclosureCitation" ADD CONSTRAINT "KnowledgeBaseDisclosureCitation_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("citationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION validate_knowledge_base_disclosure()
RETURNS trigger AS $$
DECLARE
  definition "CapabilityDefinition"%ROWTYPE;
  anchor_item_id TEXT;
BEGIN
  SELECT * INTO definition
  FROM "CapabilityDefinition"
  WHERE "capabilityDefinitionId" = NEW."capabilityDefinitionId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown CapabilityDefinition';
  END IF;

  IF NEW."operator" <> 'EXISTS' THEN
    IF definition."valueKind" = 'BOOLEAN' AND (NEW."operator" NOT IN ('EQ', 'NEQ') OR NEW."requiredBoolean" IS NULL) THEN
      RAISE EXCEPTION 'BOOLEAN disclosure requirements support only EQ or NEQ with a boolean value';
    ELSIF definition."valueKind" IN ('SCORE', 'COUNTER') AND NEW."requiredNumber" IS NULL THEN
      RAISE EXCEPTION 'Numeric disclosure requirements require a numeric value';
    ELSIF definition."valueKind" IN ('ENUM', 'REFERENCE') AND (NEW."operator" NOT IN ('EQ', 'NEQ') OR NEW."requiredToken" IS NULL) THEN
      RAISE EXCEPTION 'Token disclosure requirements support only EQ or NEQ with a token value';
    END IF;
    IF definition."valueKind" = 'ENUM' AND NOT (NEW."requiredToken" = ANY(definition."enumValues")) THEN
      RAISE EXCEPTION 'ENUM disclosure requirement uses an unregistered value';
    END IF;
  END IF;

  IF NEW."anchorBlockId" IS NOT NULL THEN
    SELECT "knowledgeBaseItemId" INTO anchor_item_id
    FROM "KnowledgeBaseBlock"
    WHERE "knowledgeBaseBlockId" = NEW."anchorBlockId";
    IF anchor_item_id IS NULL OR anchor_item_id <> NEW."knowledgeBaseItemId" THEN
      RAISE EXCEPTION 'Knowledge disclosure anchor belongs to another entry';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "KnowledgeBaseDisclosure_validate"
BEFORE INSERT OR UPDATE ON "KnowledgeBaseDisclosure"
FOR EACH ROW EXECUTE FUNCTION validate_knowledge_base_disclosure();
