CREATE TYPE "BookGroupingType" AS ENUM (
  'ATROCITY', 'DUOLOGY', 'EXODUS', 'LESSON', 'PILLAR', 'CAMPAIGN',
  'DISJOINT_TRILOGY', 'OPPOSING_FACTION'
);
CREATE TYPE "BookGroupingEditability" AS ENUM ('EDITABLE', 'LOCKED');

CREATE TABLE "BookGroupingDefinition" (
  "bookGroupingDefinitionId" TEXT NOT NULL,
  "groupingType" "BookGroupingType" NOT NULL,
  "editability" "BookGroupingEditability" NOT NULL,
  CONSTRAINT "BookGroupingDefinition_pkey" PRIMARY KEY ("bookGroupingDefinitionId")
);
CREATE UNIQUE INDEX "BookGroupingDefinition_groupingType_key"
  ON "BookGroupingDefinition"("groupingType");

CREATE TABLE "BookGroupingValue" (
  "bookGroupingValueId" TEXT NOT NULL,
  "bookGroupingDefinitionId" TEXT NOT NULL,
  "worldKey" "WorldKey" NOT NULL,
  "logicalKey" TEXT NOT NULL,
  "bookNumbers" INTEGER[] NOT NULL,
  "valueRefType" "EntityType",
  "valueRefId" TEXT,
  "ordinal" INTEGER NOT NULL,
  CONSTRAINT "BookGroupingValue_pkey" PRIMARY KEY ("bookGroupingValueId")
);
ALTER TABLE "BookGroupingValue" ADD CONSTRAINT "BookGroupingValue_bookGroupingDefinitionId_fkey"
  FOREIGN KEY ("bookGroupingDefinitionId") REFERENCES "BookGroupingDefinition"("bookGroupingDefinitionId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "BookGroupingValue_definition_world_logical_key"
  ON "BookGroupingValue"("bookGroupingDefinitionId", "worldKey", "logicalKey");
CREATE UNIQUE INDEX "BookGroupingValue_definition_world_ordinal_key"
  ON "BookGroupingValue"("bookGroupingDefinitionId", "worldKey", "ordinal");
CREATE INDEX "BookGroupingValue_worldKey_ordinal_idx" ON "BookGroupingValue"("worldKey", "ordinal");

INSERT INTO "BookGroupingDefinition" ("bookGroupingDefinitionId", "groupingType", "editability") VALUES
  ('BOOK-GROUPING-ATROCITY', 'ATROCITY', 'LOCKED'),
  ('BOOK-GROUPING-DUOLOGY', 'DUOLOGY', 'LOCKED'),
  ('BOOK-GROUPING-EXODUS', 'EXODUS', 'LOCKED'),
  ('BOOK-GROUPING-LESSON', 'LESSON', 'LOCKED'),
  ('BOOK-GROUPING-PILLAR', 'PILLAR', 'LOCKED'),
  ('BOOK-GROUPING-CAMPAIGN', 'CAMPAIGN', 'LOCKED'),
  ('BOOK-GROUPING-DISJOINT-TRILOGY', 'DISJOINT_TRILOGY', 'EDITABLE'),
  ('BOOK-GROUPING-OPPOSING-FACTION', 'OPPOSING_FACTION', 'LOCKED');

INSERT INTO "BookGroupingValue" (
  "bookGroupingValueId", "bookGroupingDefinitionId", "worldKey", "logicalKey", "bookNumbers", "ordinal"
) VALUES
  ('BOOK-GROUPING-DISJOINT-CONCORD-A', 'BOOK-GROUPING-DISJOINT-TRILOGY', 'CONCORD', 'A', ARRAY[1,2,3,10,11,12], 0),
  ('BOOK-GROUPING-DISJOINT-CONCORD-B', 'BOOK-GROUPING-DISJOINT-TRILOGY', 'CONCORD', 'B', ARRAY[4,5,6,13,14,15], 1),
  ('BOOK-GROUPING-DISJOINT-CONCORD-C', 'BOOK-GROUPING-DISJOINT-TRILOGY', 'CONCORD', 'C', ARRAY[7,8,9,16,17,18], 2),
  ('BOOK-GROUPING-DISJOINT-RUIN-A', 'BOOK-GROUPING-DISJOINT-TRILOGY', 'RUIN', 'A', ARRAY[1,2,3,10,11,12], 0),
  ('BOOK-GROUPING-DISJOINT-RUIN-B', 'BOOK-GROUPING-DISJOINT-TRILOGY', 'RUIN', 'B', ARRAY[4,5,6,13,14,15], 1),
  ('BOOK-GROUPING-DISJOINT-RUIN-C', 'BOOK-GROUPING-DISJOINT-TRILOGY', 'RUIN', 'C', ARRAY[7,8,9,16,17,18], 2),
  ('BOOK-GROUPING-DISJOINT-SCHISM-A', 'BOOK-GROUPING-DISJOINT-TRILOGY', 'SCHISM', 'A', ARRAY[1,2,3,10,11,12], 0),
  ('BOOK-GROUPING-DISJOINT-SCHISM-B', 'BOOK-GROUPING-DISJOINT-TRILOGY', 'SCHISM', 'B', ARRAY[4,5,6,13,14,15], 1),
  ('BOOK-GROUPING-DISJOINT-SCHISM-C', 'BOOK-GROUPING-DISJOINT-TRILOGY', 'SCHISM', 'C', ARRAY[7,8,9,16,17,18], 2);

CREATE OR REPLACE FUNCTION validate_book_grouping_value()
RETURNS trigger AS $$
DECLARE
  definition "BookGroupingDefinition"%ROWTYPE;
  normalized INTEGER[];
BEGIN
  SELECT * INTO definition FROM "BookGroupingDefinition"
  WHERE "bookGroupingDefinitionId" = NEW."bookGroupingDefinitionId";
  IF NOT FOUND OR definition."groupingType" <> 'DISJOINT_TRILOGY' OR definition."editability" <> 'EDITABLE' THEN
    RAISE EXCEPTION 'Only editable DISJOINT_TRILOGY values may be persisted';
  END IF;
  SELECT array_agg(book ORDER BY book) INTO normalized FROM unnest(NEW."bookNumbers") AS book;
  IF NEW."logicalKey" = '' OR NEW."ordinal" < 0 OR NEW."ordinal" > 2
    OR cardinality(NEW."bookNumbers") = 0
    OR NEW."bookNumbers" <> normalized
    OR cardinality(NEW."bookNumbers") <> (SELECT count(DISTINCT book) FROM unnest(NEW."bookNumbers") AS book)
    OR NOT NEW."bookNumbers" <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]
    OR ((NEW."valueRefType" IS NULL) <> (NEW."valueRefId" IS NULL)) THEN
    RAISE EXCEPTION 'Book grouping value identity, membership, or reference is invalid';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "BookGroupingValue_validate"
BEFORE INSERT OR UPDATE ON "BookGroupingValue"
FOR EACH ROW EXECUTE FUNCTION validate_book_grouping_value();

CREATE OR REPLACE FUNCTION validate_disjoint_trilogy_partition()
RETURNS trigger AS $$
DECLARE
  affected_world "WorldKey";
  value_count INTEGER;
  member_count INTEGER;
  distinct_member_count INTEGER;
BEGIN
  affected_world := COALESCE(NEW."worldKey", OLD."worldKey");
  SELECT count(*), COALESCE(sum(cardinality("bookNumbers")), 0)
  INTO value_count, member_count
  FROM "BookGroupingValue" value
  WHERE value."bookGroupingDefinitionId" = 'BOOK-GROUPING-DISJOINT-TRILOGY'
    AND value."worldKey" = affected_world;
  SELECT count(DISTINCT book) INTO distinct_member_count
  FROM "BookGroupingValue" value
  CROSS JOIN LATERAL unnest(value."bookNumbers") AS book
  WHERE value."bookGroupingDefinitionId" = 'BOOK-GROUPING-DISJOINT-TRILOGY'
    AND value."worldKey" = affected_world;
  IF value_count <> 3 OR member_count <> 18 OR distinct_member_count <> 18 THEN
    RAISE EXCEPTION 'DISJOINT_TRILOGY must contain three values covering Books 1 through 18 exactly once for %', affected_world;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "BookGroupingValue_partition"
AFTER INSERT OR UPDATE OR DELETE ON "BookGroupingValue"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_disjoint_trilogy_partition();
