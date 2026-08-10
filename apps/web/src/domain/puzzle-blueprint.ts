export const puzzleChallengeDurationSeconds = 2_160_000;
export const puzzleHintKinds = ["DIRECTIONAL", "GUIDED"] as const;

export interface PuzzleBlueprintSeed {
  puzzleBlueprintId: string;
  difficultyTier: 1 | 2 | 3 | 4 | 5;
  generatorVersion: number;
  hints: readonly [
    { level: 1; kind: "DIRECTIONAL"; template: string; containsAnswer: false },
    { level: 2; kind: "GUIDED"; template: string; containsAnswer: false },
  ];
}

export function validateInitialPuzzleBank(blueprints: readonly PuzzleBlueprintSeed[]) {
  if (blueprints.length !== 70) throw new Error("The initial Puzzle Blueprint bank must contain exactly 70 roots.");
  if (new Set(blueprints.map((blueprint) => blueprint.puzzleBlueprintId)).size !== blueprints.length) {
    throw new Error("Puzzle Blueprint root identities must be unique.");
  }
  for (const tier of [1, 2, 3, 4, 5] as const) {
    if (blueprints.filter((blueprint) => blueprint.difficultyTier === tier).length !== 14) {
      throw new Error(`Puzzle difficulty tier ${tier} must contain exactly 14 blueprints.`);
    }
  }
  for (const blueprint of blueprints) {
    if (!Number.isSafeInteger(blueprint.generatorVersion) || blueprint.generatorVersion < 1) throw new Error("Puzzle generator versions must be positive integers.");
    if (blueprint.hints[0].level !== 1 || blueprint.hints[0].kind !== "DIRECTIONAL" || !blueprint.hints[0].template.trim()) {
      throw new Error("Hint level 1 must be a nonempty DIRECTIONAL template.");
    }
    if (blueprint.hints[1].level !== 2 || blueprint.hints[1].kind !== "GUIDED" || !blueprint.hints[1].template.trim()) {
      throw new Error("Hint level 2 must be a nonempty GUIDED template.");
    }
    if (blueprint.hints.some((hint) => hint.containsAnswer)) throw new Error("Puzzle hint templates must not contain answers.");
  }
}

export function challengeWindowFromAcceptance(acceptedAt: Date) {
  if (Number.isNaN(acceptedAt.getTime())) throw new Error("Puzzle challenge acceptance time is invalid.");
  return Object.freeze({
    acceptedAt: new Date(acceptedAt.getTime()),
    endsAt: new Date(acceptedAt.getTime() + puzzleChallengeDurationSeconds * 1000),
    durationSeconds: puzzleChallengeDurationSeconds,
  });
}
