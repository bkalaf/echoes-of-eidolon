import {
  PuzzleDifficultyTier,
  PuzzleFamily,
  PuzzleHintKind,
  type PuzzleDifficultyTier as PuzzleDifficultyTierValue,
  type PuzzleFamily as PuzzleFamilyValue,
  type PuzzleHintKind as PuzzleHintKindValue,
} from "../generated/prisma/enums";

export const puzzleChallengeDurationSeconds = 2_160_000;
export const puzzleHintKinds = Object.values(PuzzleHintKind);
export const puzzleFamilies = Object.values(PuzzleFamily);
export const puzzleDifficultyTiers = Object.values(PuzzleDifficultyTier);

export interface PuzzleBlueprintSeed {
  puzzleBlueprintId: string;
  family: PuzzleFamilyValue;
  difficultyTier: PuzzleDifficultyTierValue;
  generatorVersion: number;
  hints: readonly [
    { level: 1; kind: PuzzleHintKindValue; template: string; containsAnswer: false },
    { level: 2; kind: PuzzleHintKindValue; template: string; containsAnswer: false },
  ];
}

export function validateInitialPuzzleBank(blueprints: readonly PuzzleBlueprintSeed[]) {
  if (blueprints.length !== 70) throw new Error("The initial Puzzle Blueprint bank must contain exactly 70 roots.");
  if (new Set(blueprints.map((blueprint) => blueprint.puzzleBlueprintId)).size !== blueprints.length) {
    throw new Error("Puzzle Blueprint root identities must be unique.");
  }
  for (const tier of puzzleDifficultyTiers) {
    if (blueprints.filter((blueprint) => blueprint.difficultyTier === tier).length !== 14) {
      throw new Error(`Puzzle difficulty tier ${tier} must contain exactly 14 blueprints.`);
    }
  }
  for (const blueprint of blueprints) {
    if (!puzzleFamilies.includes(blueprint.family)) throw new Error("Puzzle family is not registered.");
    if (!Number.isSafeInteger(blueprint.generatorVersion)) throw new Error("Puzzle generator versions must be integers.");
    if (blueprint.hints[0].level !== 1 || blueprint.hints[0].kind !== PuzzleHintKind.DIRECTIONAL || !blueprint.hints[0].template.trim()) {
      throw new Error("Hint level 1 must be a nonempty DIRECTIONAL template.");
    }
    if (blueprint.hints[1].level !== 2 || blueprint.hints[1].kind !== PuzzleHintKind.GUIDED || !blueprint.hints[1].template.trim()) {
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

export interface PuzzlePreviewInput {
  puzzleBlueprintId: string;
  generatorVersion: number;
  campaignId: string;
  playerId: string;
  attempt: number;
  seed: string;
}

export function deterministicPuzzlePreviewKey(input: PuzzlePreviewInput): string {
  if (!Number.isSafeInteger(input.generatorVersion)) throw new Error("Puzzle generator versions must be integers.");
  if (!Number.isSafeInteger(input.attempt)) throw new Error("Puzzle preview attempts must be integers.");
  return JSON.stringify([
    input.puzzleBlueprintId,
    input.generatorVersion,
    input.campaignId,
    input.playerId,
    input.attempt,
    input.seed,
  ]);
}
