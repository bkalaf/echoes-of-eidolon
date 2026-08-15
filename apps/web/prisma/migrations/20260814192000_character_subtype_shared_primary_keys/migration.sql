-- Character is the sole identity owner for Character subtypes. This migration
-- preserves subtype-specific state and refuses any unmappable or unregistered
-- foreign-key consumer instead of generating or deleting identity data.
DO $$
DECLARE
  orphan_architect_characters integer;
  orphan_witness_characters integer;
  duplicate_architect_characters integer;
  duplicate_witness_characters integer;
  unmapped_witness_architects integer;
  external_architect_consumers integer;
  external_witness_consumers integer;
BEGIN
  SELECT count(*) INTO orphan_architect_characters
  FROM "Architect" subtype LEFT JOIN "Character" character ON character."characterId" = subtype."characterId"
  WHERE character."characterId" IS NULL;

  SELECT count(*) INTO orphan_witness_characters
  FROM "Witness" subtype LEFT JOIN "Character" character ON character."characterId" = subtype."characterId"
  WHERE character."characterId" IS NULL;

  SELECT count(*) INTO duplicate_architect_characters FROM (
    SELECT "characterId" FROM "Architect" GROUP BY "characterId" HAVING count(*) > 1
  ) duplicates;

  SELECT count(*) INTO duplicate_witness_characters FROM (
    SELECT "characterId" FROM "Witness" GROUP BY "characterId" HAVING count(*) > 1
  ) duplicates;

  SELECT count(*) INTO unmapped_witness_architects
  FROM "Witness" witness LEFT JOIN "Architect" architect ON architect."architectId" = witness."architectId"
  WHERE architect."architectId" IS NULL;

  SELECT count(*) INTO external_architect_consumers
  FROM pg_constraint constraint_row
  WHERE constraint_row.contype = 'f'
    AND constraint_row.confrelid = '"Architect"'::regclass
    AND constraint_row.conname <> 'Witness_architectId_fkey';

  SELECT count(*) INTO external_witness_consumers
  FROM pg_constraint constraint_row
  WHERE constraint_row.contype = 'f'
    AND constraint_row.confrelid = '"Witness"'::regclass;

  IF orphan_architect_characters > 0 OR orphan_witness_characters > 0
    OR duplicate_architect_characters > 0 OR duplicate_witness_characters > 0
    OR unmapped_witness_architects > 0 OR external_architect_consumers > 0
    OR external_witness_consumers > 0 THEN
    RAISE EXCEPTION 'CHARACTER_SUBTYPE_INHERITANCE_BLOCKER orphanArchitectCharacters=% orphanWitnessCharacters=% duplicateArchitectCharacters=% duplicateWitnessCharacters=% unmappedWitnessArchitects=% externalArchitectConsumers=% externalWitnessConsumers=%',
      orphan_architect_characters, orphan_witness_characters,
      duplicate_architect_characters, duplicate_witness_characters,
      unmapped_witness_architects, external_architect_consumers,
      external_witness_consumers;
  END IF;
END $$;

ALTER TABLE "Witness" DROP CONSTRAINT "Witness_architectId_fkey";
DROP INDEX "Witness_architectId_idx";
ALTER TABLE "Witness" DROP CONSTRAINT "Witness_pkey";
ALTER TABLE "Architect" DROP CONSTRAINT "Architect_pkey";
DROP INDEX "Witness_characterId_key";
DROP INDEX "Architect_characterId_key";

UPDATE "Witness" witness
SET "architectId" = architect."characterId"
FROM "Architect" architect
WHERE witness."architectId" = architect."architectId";

ALTER TABLE "Witness" RENAME COLUMN "architectId" TO "architectCharacterId";
ALTER TABLE "Witness" DROP COLUMN "witnessId";
ALTER TABLE "Architect" DROP COLUMN "architectId";
ALTER TABLE "Architect" DROP COLUMN "profession";

ALTER TABLE "Architect" ADD CONSTRAINT "Architect_pkey" PRIMARY KEY ("characterId");
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_pkey" PRIMARY KEY ("characterId");
CREATE INDEX "Witness_architectCharacterId_idx" ON "Witness"("architectCharacterId");
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_architectCharacterId_fkey"
  FOREIGN KEY ("architectCharacterId") REFERENCES "Architect"("characterId") ON DELETE RESTRICT ON UPDATE CASCADE;
