import { z } from "zod";

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

const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function assertGeneratorVersion(value: string): string {
  if (!semverPattern.test(value)) throw new Error("Puzzle generatorVersion must be semantic version text such as 1.0.0.");
  return value;
}

export function compareGeneratorVersions(left: string, right: string): number {
  const parse = (value: string) => {
    const match = semverPattern.exec(value);
    if (!match) throw new Error(`Invalid Puzzle generatorVersion: ${value}`);
    return { numbers: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4] };
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index]! - b.numbers[index]!;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === undefined) return 1;
  if (b.prerelease === undefined) return -1;
  return a.prerelease.localeCompare(b.prerelease, "en", { numeric: true });
}

export interface PuzzleHintSeed {
  level: 1 | 2;
  kind: PuzzleHintKindValue;
  template: string;
  containsAnswer: false;
}

export interface PuzzleBlueprintSeed {
  puzzleBlueprintId: string;
  title: string;
  primaryFamily: PuzzleFamilyValue;
  difficultyTier: PuzzleDifficultyTierValue;
  generatorVersion: string;
  hints: readonly [PuzzleHintSeed, PuzzleHintSeed];
}

export function validatePuzzleBlueprint(blueprint: PuzzleBlueprintSeed): PuzzleBlueprintSeed {
  if (!blueprint.puzzleBlueprintId.trim() || !blueprint.title.trim()) throw new Error("Puzzle identity and title are required.");
  if (!puzzleFamilies.includes(blueprint.primaryFamily)) throw new Error("Puzzle family is not registered.");
  if (!puzzleDifficultyTiers.includes(blueprint.difficultyTier)) throw new Error("Puzzle difficulty tier is not registered.");
  assertGeneratorVersion(blueprint.generatorVersion);
  const [directional, guided] = blueprint.hints;
  if (directional.level !== 1 || directional.kind !== PuzzleHintKind.DIRECTIONAL || !directional.template.trim()) throw new Error("Hint level 1 must be a nonempty DIRECTIONAL template.");
  if (guided.level !== 2 || guided.kind !== PuzzleHintKind.GUIDED || !guided.template.trim()) throw new Error("Hint level 2 must be a nonempty GUIDED template.");
  if (blueprint.hints.some((hint) => hint.containsAnswer)) throw new Error("Puzzle hint templates must not contain answers.");
  return blueprint;
}

const actionBFamilyCounts: Readonly<Record<PuzzleFamilyValue, number>> = Object.freeze({
  TEXT_LANGUAGE_LITERARY: 10,
  CRYPTO_NUMERIC_DATA: 10,
  VISUAL_COLOR_OPTICAL: 8,
  SPATIAL_FOLDING_GEOMETRY: 8,
  AUDIO_MUSIC_SPECTRAL: 8,
  LOGIC_CONSTRAINT: 8,
  HISTORICAL_RESEARCH: 6,
  CONSTRUCTION_SIMULATION: 6,
  CROSS_MODAL: 6,
});

/** Action-B source-package validation only. This is deliberately not a runtime bank-size invariant. */
export function validatePuzzleBlueprintIntakePackage(blueprints: readonly PuzzleBlueprintSeed[]) {
  if (blueprints.length !== 70) throw new Error("The approved Action-B intake package must contain exactly 70 roots.");
  const ids = blueprints.map((blueprint) => blueprint.puzzleBlueprintId);
  if (new Set(ids).size !== ids.length) throw new Error("Puzzle Blueprint root identities must be unique.");
  for (let index = 1; index <= 70; index += 1) {
    const expected = `PZB-${String(index).padStart(3, "0")}`;
    if (!ids.includes(expected)) throw new Error(`The approved Action-B intake package is missing ${expected}.`);
  }
  for (const tier of puzzleDifficultyTiers) {
    if (blueprints.filter((blueprint) => blueprint.difficultyTier === tier).length !== 14) throw new Error(`Puzzle difficulty tier ${tier} must contain exactly 14 intake records.`);
  }
  for (const [family, count] of Object.entries(actionBFamilyCounts)) {
    if (blueprints.filter((blueprint) => blueprint.primaryFamily === family).length !== count) throw new Error(`Puzzle family ${family} must contain exactly ${count} intake records.`);
  }
  blueprints.forEach(validatePuzzleBlueprint);
}

const requiredDesignText = z.string().trim().min(1);
export const puzzleBlueprintDesignV1Schema = z.object({
  schemaVersion: z.literal("puzzle-blueprint-design-v1"),
  concept: requiredDesignText,
  secondaryFamilies: z.array(requiredDesignText),
  intendedProgressionRange: requiredDesignText,
  playerFacingModalities: z.array(requiredDesignText).min(1),
  accessibilityModalities: z.array(requiredDesignText).min(1),
  collaborationProfile: z.record(z.string(), z.unknown()),
  requiredTools: z.array(requiredDesignText),
  outsideResearchExpectation: requiredDesignText,
  answerFormat: requiredDesignText,
  serverValidationMethod: requiredDesignText,
  uniquenessProofMethod: requiredDesignText,
  estimatedSolveTime: requiredDesignText,
  implementationComplexity: requiredDesignText,
  mobileFeasibility: requiredDesignText,
  qualityScore: z.number().finite(),
  recommendationStatus: requiredDesignText,
  prototypeRequired: z.boolean(),
  prototypeDelivered: z.boolean(),
  tutorialConsideration: z.boolean(),
  highComplexityShowpiece: z.boolean(),
}).strict();

export type PuzzleBlueprintDesignV1 = z.infer<typeof puzzleBlueprintDesignV1Schema>;

export const puzzleBlueprintIntakeFieldMap = Object.freeze({
  puzzleBlueprintId: "PuzzleBlueprint.puzzleBlueprintId",
  title: "PuzzleBlueprint.title",
  primaryFamily: "PuzzleBlueprint.primaryFamily",
  difficultyTier: "PuzzleBlueprint.difficultyTier",
  generatorVersion: "PuzzleBlueprintVersion.generatorVersion",
  hintLevel1: "PuzzleHintTemplate(level=1).template",
  hintLevel2: "PuzzleHintTemplate(level=2).template",
  reusableComponentRequirementIds: "PROVENANCE_ONLY: proposal handles are not a canonical registry",
  concept: "PuzzleBlueprintVersion.design.concept",
  secondaryFamilies: "PuzzleBlueprintVersion.design.secondaryFamilies",
  intendedProgressionRange: "PuzzleBlueprintVersion.design.intendedProgressionRange",
  playerFacingModality: "PuzzleBlueprintVersion.design.playerFacingModalities",
  accessibilityModalities: "PuzzleBlueprintVersion.design.accessibilityModalities",
  collaborationProfile: "PuzzleBlueprintVersion.design.collaborationProfile",
  requiredTools: "PuzzleBlueprintVersion.design.requiredTools",
  outsideResearchExpectation: "PuzzleBlueprintVersion.design.outsideResearchExpectation",
  answerFormat: "PuzzleBlueprintVersion.design.answerFormat",
  serverValidationMethod: "PuzzleBlueprintVersion.design.serverValidationMethod",
  uniquenessProofMethod: "PuzzleBlueprintVersion.design.uniquenessProofMethod",
  estimatedSolveTime: "PuzzleBlueprintVersion.design.estimatedSolveTime",
  implementationComplexity: "PuzzleBlueprintVersion.design.implementationComplexity",
  mobileFeasibility: "PuzzleBlueprintVersion.design.mobileFeasibility",
  qualityScore: "PuzzleBlueprintVersion.design.qualityScore",
  recommendationStatus: "PuzzleBlueprintVersion.design.recommendationStatus",
  prototypeRequired: "PuzzleBlueprintVersion.design.prototypeRequired",
  prototypeDelivered: "PuzzleBlueprintVersion.design.prototypeDelivered",
  tutorialConsideration: "PuzzleBlueprintVersion.design.tutorialConsideration",
  highComplexityShowpiece: "PuzzleBlueprintVersion.design.highComplexityShowpiece",
});

export type PuzzleBlueprintIntakeRow = Record<keyof typeof puzzleBlueprintIntakeFieldMap, string>;

const splitList = (value: string) => value.split("|").map((part) => part.trim()).filter(Boolean);
const parseBoolean = (value: string, field: string) => {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${field} must be true or false.`);
};
const required = (value: string, field: string) => {
  if (!value.trim()) throw new Error(`${field} is required.`);
  return value.trim();
};

export function parsePuzzleBlueprintIntakeRow(row: PuzzleBlueprintIntakeRow) {
  const primaryFamily = required(row.primaryFamily, "primaryFamily") as PuzzleFamilyValue;
  const difficultyTier = required(row.difficultyTier, "difficultyTier") as PuzzleDifficultyTierValue;
  const generatorVersion = assertGeneratorVersion(required(row.generatorVersion, "generatorVersion"));
  let collaborationProfile: Readonly<Record<string, unknown>>;
  try {
    const parsed: unknown = JSON.parse(row.collaborationProfile);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error();
    collaborationProfile = parsed as Readonly<Record<string, unknown>>;
  } catch {
    throw new Error("collaborationProfile must be a JSON object.");
  }
  const hints = [
    { level: 1, kind: PuzzleHintKind.DIRECTIONAL, template: required(row.hintLevel1, "hintLevel1"), containsAnswer: false },
    { level: 2, kind: PuzzleHintKind.GUIDED, template: required(row.hintLevel2, "hintLevel2"), containsAnswer: false },
  ] as const;
  const root = { puzzleBlueprintId: required(row.puzzleBlueprintId, "puzzleBlueprintId"), title: required(row.title, "title"), primaryFamily, difficultyTier };
  validatePuzzleBlueprint({ ...root, generatorVersion, hints });
  const design: PuzzleBlueprintDesignV1 = {
    schemaVersion: "puzzle-blueprint-design-v1",
    concept: required(row.concept, "concept"),
    secondaryFamilies: splitList(row.secondaryFamilies),
    intendedProgressionRange: required(row.intendedProgressionRange, "intendedProgressionRange"),
    playerFacingModalities: splitList(row.playerFacingModality),
    accessibilityModalities: splitList(row.accessibilityModalities),
    collaborationProfile,
    requiredTools: splitList(row.requiredTools),
    outsideResearchExpectation: required(row.outsideResearchExpectation, "outsideResearchExpectation"),
    answerFormat: required(row.answerFormat, "answerFormat"),
    serverValidationMethod: required(row.serverValidationMethod, "serverValidationMethod"),
    uniquenessProofMethod: required(row.uniquenessProofMethod, "uniquenessProofMethod"),
    estimatedSolveTime: required(row.estimatedSolveTime, "estimatedSolveTime"),
    implementationComplexity: required(row.implementationComplexity, "implementationComplexity"),
    mobileFeasibility: required(row.mobileFeasibility, "mobileFeasibility"),
    qualityScore: Number(row.qualityScore),
    recommendationStatus: required(row.recommendationStatus, "recommendationStatus"),
    prototypeRequired: parseBoolean(row.prototypeRequired, "prototypeRequired"),
    prototypeDelivered: parseBoolean(row.prototypeDelivered, "prototypeDelivered"),
    tutorialConsideration: parseBoolean(row.tutorialConsideration, "tutorialConsideration"),
    highComplexityShowpiece: parseBoolean(row.highComplexityShowpiece, "highComplexityShowpiece"),
  };
  if (!Number.isFinite(design.qualityScore)) throw new Error("qualityScore must be numeric.");
  puzzleBlueprintDesignV1Schema.parse(design);
  return { root, version: { generatorVersion, design }, hints, provenanceOnly: { reusableComponentRequirementIds: splitList(row.reusableComponentRequirementIds) } };
}

export function challengeWindowFromAcceptance(acceptedAt: Date) {
  if (Number.isNaN(acceptedAt.getTime())) throw new Error("Puzzle challenge acceptance time is invalid.");
  return Object.freeze({ acceptedAt: new Date(acceptedAt.getTime()), endsAt: new Date(acceptedAt.getTime() + puzzleChallengeDurationSeconds * 1000), durationSeconds: puzzleChallengeDurationSeconds });
}

export interface PuzzlePreviewInput {
  puzzleBlueprintId: string;
  generatorVersion: string;
  campaignId: string;
  playerId: string;
  attempt: number;
  seed: string;
}

export function deterministicPuzzlePreviewKey(input: PuzzlePreviewInput): string {
  assertGeneratorVersion(input.generatorVersion);
  if (!Number.isSafeInteger(input.attempt)) throw new Error("Puzzle preview attempts must be integers.");
  return JSON.stringify([input.puzzleBlueprintId, input.generatorVersion, input.campaignId, input.playerId, input.attempt, input.seed]);
}
