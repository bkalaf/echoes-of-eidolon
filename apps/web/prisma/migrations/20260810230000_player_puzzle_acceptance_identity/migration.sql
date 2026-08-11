-- Puzzle acceptance is an idempotent player action for one immutable generator version.
CREATE UNIQUE INDEX "PuzzleChallengeAccepted_userId_puzzleBlueprintId_generatorVersion_key"
ON "PuzzleChallengeAccepted"("userId", "puzzleBlueprintId", "generatorVersion");
