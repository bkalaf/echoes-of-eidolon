-- Normalize the superseded Species.taxonomy JSON into shared TAX entities.
-- The explicit overrides below are bound to the read-only production preflight
-- in artifacts/taxonomy-json-preflight.json and its zero-unresolved-conflict plan.

BEGIN;

CREATE TYPE "TaxonomyType" AS ENUM ('KINGDOM', 'PHYLUM', 'CLASS', 'ORDER', 'FAMILY', 'GENUS', 'SPECIES');

CREATE TABLE "Taxonomy" (
    "taxonomyLevelId" TEXT NOT NULL,
    "type" "TaxonomyType" NOT NULL,
    "name" TEXT NOT NULL,
    "isOfficial" BOOLEAN NOT NULL,
    "text" TEXT,
    "commonName" TEXT,
    "parentTaxonomyLevelId" TEXT,
    CONSTRAINT "Taxonomy_pkey" PRIMARY KEY ("taxonomyLevelId"),
    CONSTRAINT "Taxonomy_taxonomyLevelId_check" CHECK ("taxonomyLevelId" ~ '^TAX_(KINGDOM|PHYLUM|CLASS|ORDER|FAMILY|GENUS|SPECIES)_[A-Z0-9_]+$')
);

ALTER TABLE "Species" ADD COLUMN "taxonomyLevelId" TEXT;

CREATE TEMP TABLE "_TaxonomyOverride" (
    "taxonomyLevelId" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentTaxonomyLevelId" TEXT
) ON COMMIT DROP;

INSERT INTO "_TaxonomyOverride" ("taxonomyLevelId", "name", "parentTaxonomyLevelId") VALUES
    ('TAX_KINGDOM_ANIMALIA', 'Animalia', NULL),
    ('TAX_CLASS_MAMMALIA', 'Mammalia', 'TAX_PHYLUM_CHORDATA'),
    ('TAX_PHYLUM_CHORDATA', 'Chordata', 'TAX_KINGDOM_ANIMALIA'),
    ('TAX_ORDER_SQUAMATA', 'Squamata', 'TAX_CLASS_REPTILIA'),
    ('TAX_FAMILY_ELAPIDAE', 'Elapidae', 'TAX_ORDER_SQUAMATA'),
    ('TAX_FAMILY_ALLIGATORIDAE', 'Alligatoridae', 'TAX_ORDER_CROCODYLIA'),
    ('TAX_FAMILY_IGUANIDAE', 'Iguanidae', 'TAX_ORDER_SAURIA'),
    ('TAX_FAMILY_ANGUIDAE', 'Anguidae', 'TAX_ORDER_SQUAMATA'),
    ('TAX_GENUS_ANOLIS', 'Anolis', 'TAX_FAMILY_DACTYLOIDAE'),
    ('TAX_CLASS_REPTILIA', 'Reptilia', 'TAX_PHYLUM_CHORDATA'),
    ('TAX_ORDER_TESTUDINES', 'Testudines', 'TAX_CLASS_REPTILIA'),
    ('TAX_FAMILY_TEIIDAE', 'Teiidae', 'TAX_ORDER_SQUAMATA'),
    ('TAX_ORDER_RODENTIA', 'Rodentia', 'TAX_CLASS_MAMMALIA'),
    ('TAX_GENUS_ATRACTASPIS', 'Atractaspis', 'TAX_FAMILY_LAMPROPHIIDAE'),
    ('TAX_FAMILY_BOIDAE', 'Boidae', 'TAX_ORDER_SQUAMATA'),
    ('TAX_GENUS_CHINCHILLA', 'Chinchilla', 'TAX_FAMILY_CHINCHILLIDAE'),
    ('TAX_FAMILY_AGAMIDAE', 'Agamidae', 'TAX_ORDER_SQUAMATA'),
    ('TAX_FAMILY_ERETHIZONTIDAE', 'Erethizontidae', 'TAX_ORDER_RODENTIA'),
    ('TAX_FAMILY_CICHLIDAE', 'Cichlidae', 'TAX_ORDER_CICHLIFORMES'),
    ('TAX_FAMILY_GEKKONIDAE', 'Gekkonidae', 'TAX_ORDER_SQUAMATA'),
    ('TAX_FAMILY_COLUBRIDAE', 'Colubridae', 'TAX_ORDER_SQUAMATA'),
    ('TAX_FAMILY_PYTHONIDAE', 'Pythonidae', 'TAX_ORDER_SQUAMATA'),
    ('TAX_GENUS_VARANUS', 'Varanus', 'TAX_FAMILY_VARANIDAE'),
    ('TAX_FAMILY_VARANIDAE', 'Varanidae', 'TAX_ORDER_SQUAMATA');

CREATE TEMP TABLE "_TaxonomyRaw" ON COMMIT DROP AS
WITH RECURSIVE "lineage" AS (
    SELECT "speciesId", 0 AS "depth", "taxonomy" AS "node"
    FROM "Species"
    WHERE "taxonomy" IS NOT NULL
  UNION ALL
    SELECT "speciesId", "depth" + 1, "node" -> 'parent'
    FROM "lineage"
    WHERE jsonb_typeof("node" -> 'parent') = 'object'
)
SELECT "speciesId", "depth", "node" FROM "lineage";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "_TaxonomyRaw"
    WHERE jsonb_typeof("node") <> 'object'
       OR COALESCE("node" ->> 'taxonomyLevelId', '') = ''
       OR COALESCE("node" ->> 'name', '') = ''
       OR COALESCE("node" ->> 'type', '') NOT IN ('KINGDOM', 'PHYLUM', 'CLASS', 'ORDER', 'FAMILY', 'GENUS', 'SPECIES')
       OR jsonb_typeof("node" -> 'isOfficial') <> 'boolean'
  ) THEN
    RAISE EXCEPTION 'Taxonomy normalization refused invalid embedded taxonomy data.';
  END IF;
END $$;

CREATE TEMP TABLE "_TaxonomyNormalized" ON COMMIT DROP AS
SELECT
    "raw"."speciesId",
    "raw"."depth",
    CASE
      WHEN "raw"."node" ->> 'taxonomyLevelId' = 'TAX_GENUS_DRACO' AND ("raw"."node" ->> 'isOfficial')::BOOLEAN = FALSE
        THEN 'TAX_GENUS_DRACO_MYTHOS'
      ELSE "raw"."node" ->> 'taxonomyLevelId'
    END AS "taxonomyLevelId",
    ("raw"."node" ->> 'type')::"TaxonomyType" AS "type",
    CASE
      WHEN "raw"."node" ->> 'taxonomyLevelId' = 'TAX_GENUS_DRACO' AND ("raw"."node" ->> 'isOfficial')::BOOLEAN = FALSE
        THEN 'Draco Mythos'
      ELSE COALESCE("override"."name", "raw"."node" ->> 'name')
    END AS "name",
    ("raw"."node" ->> 'isOfficial')::BOOLEAN AS "isOfficial",
    NULLIF(BTRIM("raw"."node" ->> 'text'), '') AS "text",
    NULLIF(BTRIM("raw"."node" ->> 'commonName'), '') AS "commonName",
    CASE
      WHEN "raw"."node" ->> 'taxonomyLevelId' = 'TAX_GENUS_DRACO' AND ("raw"."node" ->> 'isOfficial')::BOOLEAN = FALSE
        THEN 'TAX_FAMILY_DRACOIDAE'
      WHEN "override"."taxonomyLevelId" IS NOT NULL
        THEN "override"."parentTaxonomyLevelId"
      WHEN "raw"."node" -> 'parent' ->> 'taxonomyLevelId' = 'TAX_GENUS_DRACO'
        AND COALESCE(("raw"."node" -> 'parent' ->> 'isOfficial')::BOOLEAN, TRUE) = FALSE
        THEN 'TAX_GENUS_DRACO_MYTHOS'
      ELSE "raw"."node" -> 'parent' ->> 'taxonomyLevelId'
    END AS "parentTaxonomyLevelId"
FROM "_TaxonomyRaw" AS "raw"
LEFT JOIN "_TaxonomyOverride" AS "override"
  ON "override"."taxonomyLevelId" = "raw"."node" ->> 'taxonomyLevelId';

DO $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO conflict_count
  FROM (
    SELECT "taxonomyLevelId"
    FROM "_TaxonomyNormalized"
    GROUP BY "taxonomyLevelId"
    HAVING COUNT(DISTINCT ROW("type", "name", "isOfficial", "text", "commonName", "parentTaxonomyLevelId")) > 1
  ) AS conflicts;
  IF conflict_count <> 0 THEN
    RAISE EXCEPTION 'Taxonomy normalization found % unresolved canonical conflicts.', conflict_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "_TaxonomyNormalized" AS child
    WHERE child."parentTaxonomyLevelId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "_TaxonomyNormalized" AS parent
        WHERE parent."taxonomyLevelId" = child."parentTaxonomyLevelId"
      )
  ) THEN
    RAISE EXCEPTION 'Taxonomy normalization found a missing canonical parent.';
  END IF;
END $$;

INSERT INTO "Taxonomy" ("taxonomyLevelId", "type", "name", "isOfficial", "text", "commonName")
SELECT DISTINCT ON ("taxonomyLevelId")
    "taxonomyLevelId", "type", "name", "isOfficial", "text", "commonName"
FROM "_TaxonomyNormalized"
ORDER BY "taxonomyLevelId", "speciesId", "depth";

UPDATE "Taxonomy" AS target
SET "parentTaxonomyLevelId" = source."parentTaxonomyLevelId"
FROM (
    SELECT DISTINCT ON ("taxonomyLevelId") "taxonomyLevelId", "parentTaxonomyLevelId"
    FROM "_TaxonomyNormalized"
    ORDER BY "taxonomyLevelId", "speciesId", "depth"
) AS source
WHERE source."taxonomyLevelId" = target."taxonomyLevelId";

DO $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE walk AS (
      SELECT "taxonomyLevelId" AS origin, "taxonomyLevelId", "parentTaxonomyLevelId", ARRAY["taxonomyLevelId"] AS path, FALSE AS cycle
      FROM "Taxonomy"
      UNION ALL
      SELECT walk.origin, parent."taxonomyLevelId", parent."parentTaxonomyLevelId", walk.path || parent."taxonomyLevelId", parent."taxonomyLevelId" = ANY(walk.path)
      FROM walk
      JOIN "Taxonomy" AS parent ON parent."taxonomyLevelId" = walk."parentTaxonomyLevelId"
      WHERE NOT walk.cycle
    )
    SELECT 1 FROM walk WHERE cycle
  ) THEN
    RAISE EXCEPTION 'Taxonomy normalization produced a hierarchy cycle.';
  END IF;
END $$;

UPDATE "Species" AS species
SET "taxonomyLevelId" = source."taxonomyLevelId"
FROM "_TaxonomyNormalized" AS source
WHERE source."speciesId" = species."speciesId" AND source."depth" = 0;

DO $$
DECLARE
  source_node_count INTEGER;
  persisted_node_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT "taxonomyLevelId") INTO source_node_count FROM "_TaxonomyNormalized";
  SELECT COUNT(*) INTO persisted_node_count FROM "Taxonomy";
  IF source_node_count <> persisted_node_count THEN
    RAISE EXCEPTION 'Taxonomy node count mismatch: source %, persisted %.', source_node_count, persisted_node_count;
  END IF;
  IF EXISTS (SELECT 1 FROM "Species" WHERE "taxonomy" IS NOT NULL AND "taxonomyLevelId" IS NULL) THEN
    RAISE EXCEPTION 'Taxonomy normalization left a Species reference unresolved.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "_TaxonomyNormalized" AS source
    JOIN "Taxonomy" AS target USING ("taxonomyLevelId")
    WHERE source."type" IS DISTINCT FROM target."type"
       OR source."name" IS DISTINCT FROM target."name"
       OR source."isOfficial" IS DISTINCT FROM target."isOfficial"
       OR source."text" IS DISTINCT FROM target."text"
       OR source."commonName" IS DISTINCT FROM target."commonName"
       OR source."parentTaxonomyLevelId" IS DISTINCT FROM target."parentTaxonomyLevelId"
  ) THEN
    RAISE EXCEPTION 'Taxonomy relational comparison detected field loss.';
  END IF;
END $$;

ALTER TABLE "Species" DROP COLUMN "taxonomy";

ALTER TABLE "Taxonomy"
  ADD CONSTRAINT "Taxonomy_parentTaxonomyLevelId_fkey"
  FOREIGN KEY ("parentTaxonomyLevelId") REFERENCES "Taxonomy"("taxonomyLevelId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Species"
  ADD CONSTRAINT "Species_taxonomyLevelId_fkey"
  FOREIGN KEY ("taxonomyLevelId") REFERENCES "Taxonomy"("taxonomyLevelId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Taxonomy_type_idx" ON "Taxonomy"("type");
CREATE INDEX "Taxonomy_name_idx" ON "Taxonomy"("name");
CREATE INDEX "Taxonomy_parentTaxonomyLevelId_idx" ON "Taxonomy"("parentTaxonomyLevelId");
CREATE INDEX "Species_taxonomyLevelId_idx" ON "Species"("taxonomyLevelId");

ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'TAXONOMY';

COMMIT;
