DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "WitnessDef") THEN
    RAISE EXCEPTION 'WITNESS_DEF_CANONICAL_MIGRATION_BLOCKER: existing WitnessDef rows require owner-reviewed reconciliation';
  END IF;
END $$;

ALTER TABLE "Character" ALTER COLUMN "breedId" DROP NOT NULL;

ALTER TABLE "WitnessDef" DROP COLUMN "color";
ALTER TABLE "WitnessDef" ADD COLUMN "color" JSONB NOT NULL;
ALTER TABLE "WitnessDef" ADD COLUMN "architectSoulId" TEXT NOT NULL;

ALTER TABLE "WitnessDef"
  ADD CONSTRAINT "WitnessDef_architectSoulId_fkey"
  FOREIGN KEY ("architectSoulId") REFERENCES "Soul"("soulId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "WitnessDef_architectSoulId_idx" ON "WitnessDef"("architectSoulId");

ALTER TABLE "WitnessDef" ADD CONSTRAINT "WitnessDef_color_check" CHECK (
  jsonb_typeof("color") = 'object'
  AND "color" ?& ARRAY['SPECTRAL_VIOLET', 'GREEN', 'WHITE']
  AND ("color" - 'SPECTRAL_VIOLET' - 'GREEN' - 'WHITE') = '{}'::jsonb
  AND jsonb_typeof("color"->'SPECTRAL_VIOLET') = 'number'
  AND jsonb_typeof("color"->'GREEN') = 'number'
  AND jsonb_typeof("color"->'WHITE') = 'number'
  AND ("color"->>'SPECTRAL_VIOLET')::numeric BETWEEN 0 AND 100
  AND ("color"->>'GREEN')::numeric BETWEEN 0 AND 100
  AND ("color"->>'WHITE')::numeric BETWEEN 0 AND 100
  AND abs(
    ("color"->>'SPECTRAL_VIOLET')::numeric
    + ("color"->>'GREEN')::numeric
    + ("color"->>'WHITE')::numeric
    - 100
  ) <= 0.000001
);

DROP TYPE "WitnessColor";
