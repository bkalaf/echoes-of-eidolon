-- Persist the already-canonical Witness definition metadata and restore
-- Witness demographics from the source Architect, with two owner-locked
-- gender overrides. Existing non-null conflicts abort the whole transaction.

BEGIN;

ALTER TABLE "WitnessDef" ADD COLUMN IF NOT EXISTS "kernelKey" TEXT;
ALTER TABLE "WitnessDef" ADD COLUMN IF NOT EXISTS "worldKey" "WorldKey";
ALTER TABLE "WitnessDef" ADD COLUMN IF NOT EXISTS "bookNumber" INTEGER;

CREATE TEMP TABLE "_CanonicalWitnessDefMetadata" (
  "witnessDefId" TEXT PRIMARY KEY,
  "kernelKey" TEXT NOT NULL,
  "worldKey" "WorldKey" NOT NULL,
  "bookNumber" INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO "_CanonicalWitnessDefMetadata" ("witnessDefId", "kernelKey", "worldKey", "bookNumber") VALUES
  ('WDF_WITNESS_OF_THE_SUMMIT', 'HUMILITY', 'CONCORD', 3),
  ('WDF_WITNESS_OF_THE_SAIL', 'DRIFT', 'SCHISM', 7),
  ('WDF_WITNESS_OF_THE_BANNER', 'COURAGE', 'CONCORD', 4),
  ('WDF_WITNESS_OF_THE_TABLE', 'COMMUNITY', 'CONCORD', 13),
  ('WDF_WITNESS_OF_THE_ROAD', 'EXILE', 'RUIN', 12),
  ('WDF_WITNESS_OF_THE_BRIDGE', 'TENSION', 'RUIN', 2),
  ('WDF_WITNESS_OF_THE_KNOT', 'BOND', 'SCHISM', 1),
  ('WDF_WITNESS_OF_THE_REINS', 'CONTROL', 'CONCORD', 9),
  ('WDF_WITNESS_OF_THE_ARMOR', 'ATTRITION', 'SCHISM', 14),
  ('WDF_WITNESS_OF_THE_KEYSTONE', 'STABILITY', 'SCHISM', 13),
  ('WDF_WITNESS_OF_THE_NEEDLE', 'REFINEMENT', 'RUIN', 8),
  ('WDF_WITNESS_OF_THE_SPRING', 'RECOVERY', 'SCHISM', 10),
  ('WDF_WITNESS_OF_THE_MANTLE', 'INHERITANCE', 'RUIN', 16),
  ('WDF_WITNESS_OF_THE_RELIQUARY', 'MOURNING', 'RUIN', 11),
  ('WDF_WITNESS_OF_THE_WINDOW', 'ACKNOWLEDGMENT', 'RUIN', 4),
  ('WDF_WITNESS_OF_THE_SHIELD', 'RESCUE', 'RUIN', 13),
  ('WDF_WITNESS_OF_THE_GATE', 'SAFETY', 'RUIN', 9),
  ('WDF_WITNESS_OF_THE_CRADLE', 'CUSTODIANSHIP', 'SCHISM', 12),
  ('WDF_WITNESS_OF_THE_MOSAIC', 'IRREPARABILITY', 'RUIN', 14),
  ('WDF_WITNESS_OF_THE_ORCHARD', 'NEGLECT', 'SCHISM', 11),
  ('WDF_WITNESS_OF_STILLWATER', 'SURRENDER', 'SCHISM', 6),
  ('WDF_WITNESS_OF_THE_BALM', 'SYMPATHY', 'RUIN', 10),
  ('WDF_WITNESS_OF_WEATHERING', 'DEGRADATION', 'SCHISM', 15),
  ('WDF_WITNESS_OF_THE_LANTERN', 'JUDGMENT', 'RUIN', 3),
  ('WDF_WITNESS_OF_THE_COMPASS', 'CONSCIENCE', 'CONCORD', 12),
  ('WDF_WITNESS_OF_THE_LOCK', 'GUARDIANSHIP', 'SCHISM', 17),
  ('WDF_WITNESS_OF_THE_SEAL', 'INTEGRITY', 'CONCORD', 16),
  ('WDF_WITNESS_OF_THE_ROOT', 'ENDURANCE', 'SCHISM', 8),
  ('WDF_WITNESS_OF_THE_PRISM', 'TRUTH', 'CONCORD', 17),
  ('WDF_WITNESS_OF_THE_LEDGER', 'JUSTIFICATION', 'RUIN', 5),
  ('WDF_WITNESS_OF_THE_RING', 'COVENANT', 'RUIN', 16),
  ('WDF_WITNESS_OF_THE_KEY', 'AGENCY', 'SCHISM', 9),
  ('WDF_WITNESS_OF_THE_CHIME', 'SIGNAL', 'RUIN', 6),
  ('WDF_WITNESS_OF_THE_LOOM', 'PRODUCTIVITY', 'SCHISM', 16),
  ('WDF_WITNESS_OF_THE_HARNESS', 'SERVICE', 'CONCORD', 16),
  ('WDF_WITNESS_OF_THE_PLUMBLINE', 'IMPARTIALITY', 'CONCORD', 6),
  ('WDF_WITNESS_OF_PATCHWORK', 'CONSERVATION', 'SCHISM', 16),
  ('WDF_WITNESS_OF_THE_BELL', 'CAUTION', 'CONCORD', 5),
  ('WDF_WITNESS_OF_THE_ANCHOR', 'ASSURANCE', 'RUIN', 1),
  ('WDF_WITNESS_OF_THE_DAM', 'RESTRAINT', 'CONCORD', 8),
  ('WDF_WITNESS_OF_THE_BLINDFOLD', 'JUSTICE', 'CONCORD', 7),
  ('WDF_WITNESS_OF_THE_HAMMER', 'REDRESS', 'RUIN', 17),
  ('WDF_WITNESS_OF_THE_COIN', 'RECIPROCITY', 'SCHISM', 4),
  ('WDF_WITNESS_OF_THE_HOURGLASS', 'DELIBERATION', 'CONCORD', 1),
  ('WDF_WITNESS_OF_THE_ROPE', 'RELIANCE', 'RUIN', 7),
  ('WDF_WITNESS_OF_THE_MIRROR', 'ESTEEM', 'CONCORD', 14),
  ('WDF_WITNESS_OF_THE_SIGIL', 'AFFILIATION', 'RUIN', 15),
  ('WDF_WITNESS_OF_THE_LENS', 'DISENCHANTMENT', 'SCHISM', 5),
  ('WDF_WITNESS_OF_THE_FLAME', 'CONVICTION', 'CONCORD', 15),
  ('WDF_WITNESS_OF_THE_VEIL', 'PEACE', 'CONCORD', 11),
  ('WDF_WITNESS_OF_THE_HEARTH', 'TRADITION', 'CONCORD', 10),
  ('WDF_WITNESS_OF_THE_LAUREL', 'REPUTATION', 'SCHISM', 2),
  ('WDF_WITNESS_OF_THE_SPOTLIGHT', 'PRESTIGE', 'CONCORD', 2),
  ('WDF_WITNESS_OF_THE_ARENA', 'RIVALRY', 'SCHISM', 3);

DO $$
DECLARE
  definition_count INTEGER;
  witness_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO definition_count FROM "WitnessDef";
  SELECT COUNT(*) INTO witness_count FROM "Witness";
  IF definition_count NOT IN (0, 54) THEN
    RAISE EXCEPTION 'FINAL_WITNESS_REMEDIATION_BLOCKER: expected zero or 54 WitnessDef rows, found %', definition_count;
  END IF;
  IF witness_count NOT IN (0, 54) THEN
    RAISE EXCEPTION 'FINAL_WITNESS_REMEDIATION_BLOCKER: expected zero or 54 Witness rows, found %', witness_count;
  END IF;
  IF definition_count = 54 AND EXISTS (
    SELECT 1 FROM "WitnessDef" definition
    FULL JOIN "_CanonicalWitnessDefMetadata" canonical USING ("witnessDefId")
    WHERE definition."witnessDefId" IS NULL OR canonical."witnessDefId" IS NULL
  ) THEN
    RAISE EXCEPTION 'FINAL_WITNESS_REMEDIATION_BLOCKER: persisted WitnessDef IDs differ from the 54-row canonical roster';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "WitnessDef" definition
    JOIN "_CanonicalWitnessDefMetadata" canonical USING ("witnessDefId")
    WHERE (definition."kernelKey" IS NOT NULL AND definition."kernelKey" <> canonical."kernelKey")
       OR (definition."worldKey" IS NOT NULL AND definition."worldKey" <> canonical."worldKey")
       OR (definition."bookNumber" IS NOT NULL AND definition."bookNumber" <> canonical."bookNumber")
  ) THEN
    RAISE EXCEPTION 'FINAL_WITNESS_REMEDIATION_BLOCKER: existing WitnessDef metadata conflicts with canonical values';
  END IF;
END $$;

UPDATE "WitnessDef" definition
SET
  "kernelKey" = COALESCE(definition."kernelKey", canonical."kernelKey"),
  "worldKey" = COALESCE(definition."worldKey", canonical."worldKey"),
  "bookNumber" = COALESCE(definition."bookNumber", canonical."bookNumber")
FROM "_CanonicalWitnessDefMetadata" canonical
WHERE definition."witnessDefId" = canonical."witnessDefId"
  AND (definition."kernelKey" IS NULL OR definition."worldKey" IS NULL OR definition."bookNumber" IS NULL);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Witness" witness
    JOIN "Character" witness_character ON witness_character."characterId" = witness."characterId"
    LEFT JOIN "Architect" architect ON architect."characterId" = witness."architectCharacterId"
    LEFT JOIN "Character" source_character ON source_character."characterId" = architect."characterId"
    WHERE source_character."characterId" IS NULL
       OR source_character."age" IS NULL
       OR source_character."gender" IS NULL
       OR (witness_character."age" IS NOT NULL AND witness_character."age" <> source_character."age")
       OR (
         witness_character."gender" IS NOT NULL
         AND witness_character."gender" <> CASE witness."characterId"
           WHEN 'CHA_WITNESS_OF_THE_LOOM' THEN 'MALE'
           WHEN 'CHA_WITNESS_OF_PATCHWORK' THEN 'FEMALE'
           ELSE source_character."gender"
         END
         AND NOT (
           witness."characterId" IN ('CHA_WITNESS_OF_THE_LOOM', 'CHA_WITNESS_OF_PATCHWORK')
           AND witness_character."gender" = source_character."gender"
         )
       )
  ) THEN
    RAISE EXCEPTION 'FINAL_WITNESS_REMEDIATION_BLOCKER: missing source demographics or conflicting non-null Witness demographics';
  END IF;
END $$;

UPDATE "Character" witness_character
SET
  "age" = COALESCE(witness_character."age", source_character."age"),
  "gender" = CASE witness."characterId"
    WHEN 'CHA_WITNESS_OF_THE_LOOM' THEN 'MALE'
    WHEN 'CHA_WITNESS_OF_PATCHWORK' THEN 'FEMALE'
    ELSE COALESCE(witness_character."gender", source_character."gender")
  END
FROM "Witness" witness
JOIN "Architect" architect ON architect."characterId" = witness."architectCharacterId"
JOIN "Character" source_character ON source_character."characterId" = architect."characterId"
WHERE witness_character."characterId" = witness."characterId"
  AND (
    witness_character."age" IS NULL
    OR witness_character."gender" IS NULL
    OR (
      witness."characterId" IN ('CHA_WITNESS_OF_THE_LOOM', 'CHA_WITNESS_OF_PATCHWORK')
      AND witness_character."gender" = source_character."gender"
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "WitnessDef" WHERE "kernelKey" IS NULL OR btrim("kernelKey") = '' OR "worldKey" IS NULL OR "bookNumber" IS NULL OR "bookNumber" NOT BETWEEN 1 AND 18) THEN
    RAISE EXCEPTION 'FINAL_WITNESS_REMEDIATION_BLOCKER: WitnessDef metadata backfill is incomplete or invalid';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "Witness" witness
    JOIN "Character" witness_character ON witness_character."characterId" = witness."characterId"
    JOIN "Character" source_character ON source_character."characterId" = witness."architectCharacterId"
    WHERE witness_character."age" IS DISTINCT FROM source_character."age"
       OR witness_character."gender" IS DISTINCT FROM CASE witness."characterId"
         WHEN 'CHA_WITNESS_OF_THE_LOOM' THEN 'MALE'
         WHEN 'CHA_WITNESS_OF_PATCHWORK' THEN 'FEMALE'
         ELSE source_character."gender"
       END
  ) THEN
    RAISE EXCEPTION 'FINAL_WITNESS_REMEDIATION_BLOCKER: Witness demographic verification failed';
  END IF;
END $$;

ALTER TABLE "WitnessDef" ALTER COLUMN "kernelKey" SET NOT NULL;
ALTER TABLE "WitnessDef" ALTER COLUMN "worldKey" SET NOT NULL;
ALTER TABLE "WitnessDef" ALTER COLUMN "bookNumber" SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WitnessDef_kernelKey_check' AND conrelid = '"WitnessDef"'::regclass) THEN
    ALTER TABLE "WitnessDef" ADD CONSTRAINT "WitnessDef_kernelKey_check" CHECK (btrim("kernelKey") <> '');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WitnessDef_bookNumber_check' AND conrelid = '"WitnessDef"'::regclass) THEN
    ALTER TABLE "WitnessDef" ADD CONSTRAINT "WitnessDef_bookNumber_check" CHECK ("bookNumber" BETWEEN 1 AND 18);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "WitnessDef_worldKey_bookNumber_idx" ON "WitnessDef"("worldKey", "bookNumber");

COMMIT;
