CREATE TYPE "PopulationKind" AS ENUM ('HUMAN', 'BEAST', 'MYTHOS', 'PET');

ALTER TABLE "Breed" ADD COLUMN "populationKind" "PopulationKind";

UPDATE "Breed"
SET "populationKind" = CASE left("groupId"::text, 1)
  WHEN 'H' THEN 'HUMAN'::"PopulationKind"
  WHEN 'B' THEN 'BEAST'::"PopulationKind"
  WHEN 'M' THEN 'MYTHOS'::"PopulationKind"
  WHEN 'P' THEN 'PET'::"PopulationKind"
END;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Breed" WHERE "populationKind" IS NULL) THEN
    RAISE EXCEPTION 'Breed populationKind backfill could not classify every existing Breed.';
  END IF;
END $$;

ALTER TABLE "Breed" ALTER COLUMN "populationKind" SET NOT NULL;

ALTER TABLE "Breed" ADD CONSTRAINT "Breed_population_kind_group_check" CHECK (
  left("groupId"::text, 1) = CASE "populationKind"
    WHEN 'HUMAN' THEN 'H'
    WHEN 'BEAST' THEN 'B'
    WHEN 'MYTHOS' THEN 'M'
    WHEN 'PET' THEN 'P'
  END
);

ALTER TABLE "Breed" ADD CONSTRAINT "Breed_pet_population_nullability_check" CHECK (
  "populationKind" <> 'PET'
  OR (
    "cultureId" IS NULL
    AND "personalityId" IS NULL
    AND "accent" IS NULL
    AND "clothing" IS NULL
    AND "architecture" IS NULL
    AND "motivation" IS NULL
    AND "operatingStyle" IS NULL
    AND "structureOrientation" IS NULL
    AND "administrationMode" IS NULL
    AND "ownershipMode" IS NULL
    AND "allocationMode" IS NULL
    AND "legitimacyBasis" IS NULL
    AND "authoritySource" IS NULL
    AND "loquacity" IS NULL
    AND "emotionalTemperature" IS NULL
    AND "outlookOrientation" IS NULL
    AND "collaborativePosture" IS NULL
  )
);
