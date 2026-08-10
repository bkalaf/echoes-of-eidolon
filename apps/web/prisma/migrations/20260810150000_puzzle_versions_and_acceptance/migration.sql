-- Fail closed before converting the former open string/integer root fields.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "PuzzleBlueprint"
    WHERE "family" NOT IN (
      'TEXT_LANGUAGE_LITERARY', 'CRYPTO_NUMERIC_DATA', 'VISUAL_COLOR_OPTICAL',
      'SPATIAL_FOLDING_GEOMETRY', 'AUDIO_MUSIC_SPECTRAL', 'LOGIC_CONSTRAINT',
      'HISTORICAL_RESEARCH', 'CONSTRUCTION_SIMULATION', 'CROSS_MODAL'
    ) OR "difficultyTier" NOT BETWEEN 1 AND 5
  ) THEN
    RAISE EXCEPTION 'PuzzleBlueprint contains an unregistered family or difficulty tier';
  END IF;
END $$;

ALTER TABLE "PuzzleBlueprint" DROP CONSTRAINT "PuzzleBlueprint_tier_check";
ALTER TABLE "PuzzleBlueprint" DROP CONSTRAINT "PuzzleBlueprint_authored_hints_check";

ALTER TABLE "PuzzleBlueprint"
ALTER COLUMN "family" TYPE "PuzzleFamily"
USING ("family"::text::"PuzzleFamily"),
ALTER COLUMN "difficultyTier" TYPE "PuzzleDifficultyTier"
USING (
  CASE "difficultyTier"
    WHEN 1 THEN 'TIER_1_INITIATE'::"PuzzleDifficultyTier"
    WHEN 2 THEN 'TIER_2_ADEPT'::"PuzzleDifficultyTier"
    WHEN 3 THEN 'TIER_3_EXPERT'::"PuzzleDifficultyTier"
    WHEN 4 THEN 'TIER_4_MASTER'::"PuzzleDifficultyTier"
    WHEN 5 THEN 'TIER_5_ORDEAL'::"PuzzleDifficultyTier"
  END
);

-- CreateTable
CREATE TABLE "PuzzleBlueprintVersion" (
    "puzzleBlueprintId" TEXT NOT NULL,
    "generatorVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PuzzleBlueprintVersion_pkey" PRIMARY KEY ("puzzleBlueprintId", "generatorVersion")
);

-- CreateTable
CREATE TABLE "PuzzleHintTemplate" (
    "puzzleBlueprintId" TEXT NOT NULL,
    "generatorVersion" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "kind" "PuzzleHintKind" NOT NULL,
    "template" TEXT NOT NULL,

    CONSTRAINT "PuzzleHintTemplate_pkey" PRIMARY KEY ("puzzleBlueprintId", "generatorVersion", "level")
);

-- Preserve every existing version and its two authored hints losslessly.
INSERT INTO "PuzzleBlueprintVersion" ("puzzleBlueprintId", "generatorVersion")
SELECT "puzzleBlueprintId", "generatorVersion" FROM "PuzzleBlueprint";

INSERT INTO "PuzzleHintTemplate" ("puzzleBlueprintId", "generatorVersion", "level", "kind", "template")
SELECT "puzzleBlueprintId", "generatorVersion", 1, 'DIRECTIONAL'::"PuzzleHintKind", "hint1" FROM "PuzzleBlueprint"
UNION ALL
SELECT "puzzleBlueprintId", "generatorVersion", 2, 'GUIDED'::"PuzzleHintKind", "hint2" FROM "PuzzleBlueprint";

ALTER TABLE "PuzzleBlueprint"
DROP COLUMN "hint1",
DROP COLUMN "hint2",
DROP COLUMN "generatorVersion";

-- CreateTable
CREATE TABLE "PuzzleChallengeAccepted" (
    "puzzleChallengeAcceptedId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleBlueprintId" TEXT NOT NULL,
    "generatorVersion" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PuzzleChallengeAccepted_pkey" PRIMARY KEY ("puzzleChallengeAcceptedId")
);

ALTER TABLE "PuzzleHintTemplate" ADD CONSTRAINT "PuzzleHintTemplate_shape_check"
CHECK (
  (("level" = 1 AND "kind" = 'DIRECTIONAL') OR ("level" = 2 AND "kind" = 'GUIDED'))
  AND length(btrim("template")) > 0
);

-- CreateIndex
CREATE INDEX "PuzzleChallengeAccepted_userId_idx" ON "PuzzleChallengeAccepted"("userId");

-- CreateIndex
CREATE INDEX "PuzzleChallengeAccepted_version_idx" ON "PuzzleChallengeAccepted"("puzzleBlueprintId", "generatorVersion");

-- AddForeignKey
ALTER TABLE "PuzzleBlueprintVersion" ADD CONSTRAINT "PuzzleBlueprintVersion_puzzleBlueprintId_fkey" FOREIGN KEY ("puzzleBlueprintId") REFERENCES "PuzzleBlueprint"("puzzleBlueprintId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleHintTemplate" ADD CONSTRAINT "PuzzleHintTemplate_version_fkey" FOREIGN KEY ("puzzleBlueprintId", "generatorVersion") REFERENCES "PuzzleBlueprintVersion"("puzzleBlueprintId", "generatorVersion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleChallengeAccepted" ADD CONSTRAINT "PuzzleChallengeAccepted_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleChallengeAccepted" ADD CONSTRAINT "PuzzleChallengeAccepted_version_fkey" FOREIGN KEY ("puzzleBlueprintId", "generatorVersion") REFERENCES "PuzzleBlueprintVersion"("puzzleBlueprintId", "generatorVersion") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION validate_puzzle_version_hints()
RETURNS trigger AS $$
DECLARE
  blueprint_id TEXT;
  version_number INTEGER;
  hint_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    blueprint_id := OLD."puzzleBlueprintId";
    version_number := OLD."generatorVersion";
  ELSE
    blueprint_id := NEW."puzzleBlueprintId";
    version_number := NEW."generatorVersion";
  END IF;

  IF EXISTS (
    SELECT 1 FROM "PuzzleBlueprintVersion"
    WHERE "puzzleBlueprintId" = blueprint_id AND "generatorVersion" = version_number
  ) THEN
    SELECT count(*) INTO hint_count
    FROM "PuzzleHintTemplate"
    WHERE "puzzleBlueprintId" = blueprint_id AND "generatorVersion" = version_number;
    IF hint_count <> 2 THEN
      RAISE EXCEPTION 'PuzzleBlueprintVersion requires exactly two authored hints';
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "PuzzleBlueprintVersion_hint_count"
AFTER INSERT ON "PuzzleBlueprintVersion"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_puzzle_version_hints();

CREATE CONSTRAINT TRIGGER "PuzzleHintTemplate_hint_count"
AFTER INSERT OR DELETE ON "PuzzleHintTemplate"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_puzzle_version_hints();

CREATE OR REPLACE FUNCTION reject_puzzle_version_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PuzzleBlueprintVersion history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PuzzleBlueprintVersion_reject_update"
BEFORE UPDATE OR DELETE ON "PuzzleBlueprintVersion"
FOR EACH ROW EXECUTE FUNCTION reject_puzzle_version_mutation();

CREATE TRIGGER "PuzzleHintTemplate_reject_update"
BEFORE UPDATE OR DELETE ON "PuzzleHintTemplate"
FOR EACH ROW EXECUTE FUNCTION reject_puzzle_version_mutation();

CREATE OR REPLACE FUNCTION reject_puzzle_acceptance_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PuzzleChallengeAccepted is immutable after acceptance';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PuzzleChallengeAccepted_reject_update"
BEFORE UPDATE OR DELETE ON "PuzzleChallengeAccepted"
FOR EACH ROW EXECUTE FUNCTION reject_puzzle_acceptance_mutation();
