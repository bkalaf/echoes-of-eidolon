ALTER TABLE "Breed" ADD COLUMN "parentBreedId" TEXT;

ALTER TABLE "Breed" ADD CONSTRAINT "Breed_parentBreedId_not_self_check" CHECK (
  "parentBreedId" IS NULL OR "parentBreedId" <> "breedId"
);

CREATE INDEX "Breed_parentBreedId_idx" ON "Breed"("parentBreedId");

ALTER TABLE "Breed" ADD CONSTRAINT "Breed_parentBreedId_fkey"
  FOREIGN KEY ("parentBreedId") REFERENCES "Breed"("breedId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "validate_breed_hierarchy"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parent_species_id TEXT;
  parent_population_kind "PopulationKind";
  cycle_found BOOLEAN;
BEGIN
  IF NEW."parentBreedId" IS NOT NULL THEN
    SELECT "speciesId", "populationKind"
      INTO parent_species_id, parent_population_kind
      FROM "Breed" WHERE "breedId" = NEW."parentBreedId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Breed parent % does not exist.', NEW."parentBreedId";
    END IF;
    IF parent_species_id <> NEW."speciesId" THEN
      RAISE EXCEPTION 'Breed parent % must share Species %.', NEW."parentBreedId", NEW."speciesId";
    END IF;
    IF parent_population_kind <> NEW."populationKind" THEN
      RAISE EXCEPTION 'Breed parent % must share populationKind %.', NEW."parentBreedId", NEW."populationKind";
    END IF;
    WITH RECURSIVE ancestors AS (
      SELECT "breedId", "parentBreedId" FROM "Breed" WHERE "breedId" = NEW."parentBreedId"
      UNION
      SELECT parent."breedId", parent."parentBreedId"
      FROM "Breed" parent JOIN ancestors child ON parent."breedId" = child."parentBreedId"
    )
    SELECT EXISTS (SELECT 1 FROM ancestors WHERE "breedId" = NEW."breedId") INTO cycle_found;
    IF cycle_found THEN
      RAISE EXCEPTION 'Breed hierarchy cycle detected for %.', NEW."breedId";
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Breed" child
    WHERE child."parentBreedId" = NEW."breedId"
      AND (child."speciesId" <> NEW."speciesId" OR child."populationKind" <> NEW."populationKind")
  ) THEN
    RAISE EXCEPTION 'Breed % cannot change Species or populationKind while it has incompatible children.', NEW."breedId";
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "Breed_hierarchy_guard"
BEFORE INSERT OR UPDATE OF "breedId", "speciesId", "populationKind", "parentBreedId" ON "Breed"
FOR EACH ROW EXECUTE FUNCTION "validate_breed_hierarchy"();
