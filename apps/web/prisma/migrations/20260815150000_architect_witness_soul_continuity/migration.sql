-- Concrete Witness transformation preserves Soul identity. Witness and source
-- Architect remain distinct Character rows and share Character.soulId.

UPDATE "Architect"
SET "department" = NULL
WHERE "characterId" IN ('CHA_HANS_HALYCON_HOHENZOLLERN', 'CHA_NOELL_PIETER_SMUKK');

ALTER TABLE "Architect" ALTER COLUMN "department" TYPE TEXT USING "department"::text;
ALTER TABLE "WitnessDef" ALTER COLUMN "department" TYPE TEXT USING "department"::text;

UPDATE "WitnessDef"
SET "department" = 'SPONSORSHIP'
WHERE "department" = 'PATRON' AND "name" IN ('Witness of the Spotlight', 'The Witness of the Spotlight');

UPDATE "WitnessDef"
SET "department" = 'INNOVATION'
WHERE "department" = 'TECHNOCRAT' AND "name" IN ('Witness of the Arena', 'The Witness of the Arena');

DO $$
DECLARE
  stale_departments integer;
  duplicate_architect_departments integer;
  duplicate_witness_def_departments integer;
  invalid_soul_chains integer;
  presiding_witnesses integer;
BEGIN
  SELECT count(*) INTO stale_departments
  FROM (
    SELECT "department" FROM "Architect" WHERE "department" IN ('PATRON', 'TECHNOCRAT')
    UNION ALL
    SELECT "department" FROM "WitnessDef" WHERE "department" IN ('PATRON', 'TECHNOCRAT')
  ) stale;

  SELECT count(*) INTO duplicate_architect_departments FROM (
    SELECT "department" FROM "Architect" WHERE "department" IS NOT NULL
    GROUP BY "department" HAVING count(*) > 1
  ) duplicates;

  SELECT count(*) INTO duplicate_witness_def_departments FROM (
    SELECT "department" FROM "WitnessDef" GROUP BY "department" HAVING count(*) > 1
  ) duplicates;

  SELECT count(*) INTO invalid_soul_chains
  FROM "Witness" witness
  JOIN "Character" witness_character ON witness_character."characterId" = witness."characterId"
  JOIN "Architect" architect ON architect."characterId" = witness."architectCharacterId"
  JOIN "Character" architect_character ON architect_character."characterId" = architect."characterId"
  WHERE witness_character."soulId" IS NULL
    OR architect_character."soulId" IS NULL
    OR witness_character."soulId" <> architect_character."soulId";

  SELECT count(*) INTO presiding_witnesses
  FROM "Witness"
  WHERE "architectCharacterId" IN ('CHA_HANS_HALYCON_HOHENZOLLERN', 'CHA_NOELL_PIETER_SMUKK');

  IF stale_departments > 0 OR duplicate_architect_departments > 0
    OR duplicate_witness_def_departments > 0 OR invalid_soul_chains > 0
    OR presiding_witnesses > 0 THEN
    RAISE EXCEPTION 'ARCHITECT_WITNESS_CANON_BLOCKER staleDepartments=% duplicateArchitectDepartments=% duplicateWitnessDefDepartments=% invalidSoulChains=% presidingWitnesses=%',
      stale_departments, duplicate_architect_departments,
      duplicate_witness_def_departments, invalid_soul_chains,
      presiding_witnesses;
  END IF;
END $$;

DROP TYPE "ArchitectDepartment";
CREATE TYPE "ArchitectDepartment" AS ENUM (
  'ASTRONOMY', 'NAVIGATION', 'PROPULSION', 'HABITABILITY', 'PLANETOLOGY',
  'PHYSICS', 'CHEMISTRY', 'COMPUTING', 'MATERIALS', 'ENERGY',
  'NANOTECHNOLOGY', 'BIOLOGY', 'GENETICS', 'CRYOBIOLOGY', 'NEUROSCIENCE',
  'MEDICINE', 'EPIDEMIOLOGY', 'ECOLOGY', 'TERRAFORMING', 'AGRICULTURE',
  'BOTANY', 'ZOOLOGY', 'MICROBIOLOGY', 'INTELLIGENCE', 'ALIGNMENT',
  'SOFTWARE', 'CYBERSECURITY', 'CONTINUITY', 'ARCHIVES', 'SYSTEMS',
  'ARCHITECTURE', 'ROBOTICS', 'ELECTRICAL', 'MANUFACTURING', 'LOGISTICS',
  'RESOURCES', 'RECYCLING', 'SAFETY', 'RELIABILITY', 'COMMAND',
  'GOVERNANCE', 'JUSTICE', 'ECONOMICS', 'ADMINISTRATION', 'SOCIOLOGY',
  'PSYCHOLOGY', 'ANTHROPOLOGY', 'HISTORY', 'EDUCATION', 'LINGUISTICS',
  'HUMANITIES', 'OUTREACH', 'SPONSORSHIP', 'INNOVATION'
);

ALTER TABLE "Architect" ALTER COLUMN "department" TYPE "ArchitectDepartment" USING "department"::"ArchitectDepartment";
ALTER TABLE "Architect" ALTER COLUMN "department" DROP NOT NULL;
ALTER TABLE "WitnessDef" ALTER COLUMN "department" TYPE "ArchitectDepartment" USING "department"::"ArchitectDepartment";
CREATE UNIQUE INDEX "Architect_department_key" ON "Architect"("department");
CREATE UNIQUE INDEX "WitnessDef_department_key" ON "WitnessDef"("department");

ALTER TABLE "Character" ALTER COLUMN "age" DROP NOT NULL;
ALTER TABLE "Character" ALTER COLUMN "skinScaleColor" DROP NOT NULL;
ALTER TABLE "Character" ALTER COLUMN "hairFurColor" DROP NOT NULL;
ALTER TABLE "Character" ALTER COLUMN "eyeColor" DROP NOT NULL;
ALTER TABLE "Character" ALTER COLUMN "clothing" DROP NOT NULL;
ALTER TABLE "Witness" ALTER COLUMN "trueFlawName" DROP NOT NULL;
ALTER TABLE "Witness" ALTER COLUMN "legendaryRewardId" DROP NOT NULL;
