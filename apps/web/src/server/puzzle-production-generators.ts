import { createHmac, timingSafeEqual } from "node:crypto";

import catalogSource from "../../data/puzzles/puzzle-prototype-catalog-70.json";
import { loadPuzzlePrototypeCatalog, type PuzzlePrototypeCatalogEntry } from "../domain/puzzle-prototype-catalog";
import { productionPresentationById, productionPuzzleVersionCatalog, type ProductionPuzzleSlug } from "../domain/puzzle-production-version-catalog";
import { generateTutorialPuzzle, solveTutorialPuzzle, tutorialPuzzleBlueprintIds, type GeneratedTutorialPuzzle, type TutorialCarrier, type TutorialGeneratorVersion } from "./puzzle-tutorial-generators";

export const productionFamilyKinds = Object.freeze({
  TEXT_LANGUAGE_LITERARY: "TEXT_DOCUMENT_PAIR",
  CRYPTO_NUMERIC_DATA: "NUMERIC_LEDGER",
  VISUAL_COLOR_OPTICAL: "VISUAL_SHAPE_LAYERS",
  SPATIAL_FOLDING_GEOMETRY: "SPATIAL_ROUTE_BOARD",
  AUDIO_MUSIC_SPECTRAL: "AUDIO_CAPTION_SEQUENCE",
  LOGIC_CONSTRAINT: "LOGIC_CONSTRAINT_GRID",
  HISTORICAL_RESEARCH: "RESEARCH_CLAIM_CHAIN",
  CONSTRUCTION_SIMULATION: "MECHANISM_REGISTER_BOARD",
  CROSS_MODAL: "CROSS_MODAL_SIGNAL_PAIRS",
} as const);

type ProductionFamily = keyof typeof productionFamilyKinds;
type ProductionFamilyKind = (typeof productionFamilyKinds)[ProductionFamily];

export interface EncodedClue {
  encodedValue: number;
  ordinal: number;
}

interface TextCarrier { kind: "TEXT_DOCUMENT_PAIR"; decodeOffset: number; documentA: EncodedClue[]; documentB: EncodedClue[]; instructions: string }
interface NumericCarrier { kind: "NUMERIC_LEDGER"; decodeOffset: number; cells: EncodedClue[]; instructions: string }
interface VisualCarrier { kind: "VISUAL_SHAPE_LAYERS"; decodeOffset: number; layers: Array<EncodedClue & { shape: string; texture: string }>; instructions: string }
interface SpatialCarrier { kind: "SPATIAL_ROUTE_BOARD"; decodeOffset: number; tiles: Array<EncodedClue & { keyboardLabel: string }>; instructions: string }
interface AudioCarrier { kind: "AUDIO_CAPTION_SEQUENCE"; decodeOffset: number; events: Array<EncodedClue & { caption: string; note: string }>; instructions: string }
interface LogicCarrier { kind: "LOGIC_CONSTRAINT_GRID"; decodeOffset: number; constraints: Array<EncodedClue & { relation: string }>; instructions: string }
interface ResearchCarrier { kind: "RESEARCH_CLAIM_CHAIN"; decodeOffset: number; claims: Array<EncodedClue & { citation: string; claimLabel: string }>; instructions: string }
interface ConstructionCarrier { kind: "MECHANISM_REGISTER_BOARD"; decodeOffset: number; registers: Array<EncodedClue & { control: string }>; instructions: string }
interface CrossModalCarrier { kind: "CROSS_MODAL_SIGNAL_PAIRS"; decodeOffset: number; pairs: Array<EncodedClue & { audioCaption: string; visualCue: string }>; instructions: string }

export type GenericProductionCarrier = TextCarrier | NumericCarrier | VisualCarrier | SpatialCarrier | AudioCarrier | LogicCarrier | ResearchCarrier | ConstructionCarrier | CrossModalCarrier;
export type ProductionCarrier = GenericProductionCarrier | TutorialCarrier;

export interface ProductionGeneratorCatalogEntry {
  accessibilityModes: string[];
  answerDerivation: string;
  answerFormat: string;
  concept: string;
  decoys: string[];
  difficultyTier: string;
  expectedSolvePath: string[];
  generatorVersion: string;
  hints: Array<{ kind: string; level: number; text: string }>;
  playerFacingModalities: string[];
  primaryFamily: ProductionFamily;
  publicDescription?: string;
  publicSlug?: ProductionPuzzleSlug;
  publicTitle?: string;
  opening?: string;
  puzzleBlueprintId: string;
  sources: string[];
  title: string;
}

export interface PuzzleGeneratorReadinessEntry extends ProductionGeneratorCatalogEntry {
  implementationPath: string | null;
  productionStatus: "PRODUCTION" | "PROTOTYPE_ONLY";
}

export interface GeneratedProductionPuzzle {
  accessibilityModes: string[];
  alternateSolutionsRejected: true;
  answerFormat: string;
  canonicalSolution: string;
  carrier: ProductionCarrier;
  concept: string;
  difficultyTier: string;
  expectedSolvePath: string[];
  familyKind: ProductionFamilyKind;
  generatorVersion: string;
  hints: Array<{ kind: string; level: number; text: string }>;
  instanceChecksum: string;
  instanceId: string;
  liveRuntimeRecordsCreated: 0;
  playerFacingModalities: string[];
  primaryFamily: ProductionFamily;
  proofDigest: string;
  puzzleBlueprintId: string;
  timerStarted: false;
  title: string;
  tutorialInstance?: GeneratedTutorialPuzzle;
  uniqueSolution: true;
}

export interface CancellationPlayerArtifact {
  matrixA: number[][];
  matrixB: number[][];
}

export interface SetPlayerArtifact {
  scopeCards: string[];
  seal: { memberCount: number; memberProduct: number; memberTotal: number };
  sets: Record<"A" | "B" | "C", number[]>;
}

export interface PallPlayerArtifact {
  luminanceRows: number[][];
}

export interface MusicPlayerArtifact {
  scoreEvents: Array<{ beat: number; control: boolean; measure: number; note: string; octave: number }>;
}

export type PlayerPuzzle = {
  accessibilityModes: string[];
  artifact: CancellationPlayerArtifact | SetPlayerArtifact | PallPlayerArtifact | MusicPlayerArtifact;
  hints: Array<{ level: number; text: string }>;
  opening: string;
  publicSlug: ProductionPuzzleSlug;
  publicTitle: string;
};

/** @deprecated Use PlayerPuzzle. Kept as a source-compatible name for the canonical QA wrapper. */
export type PublicProductionPuzzle = PlayerPuzzle;

const catalog = loadPuzzlePrototypeCatalog(catalogSource);
const tutorialIds = new Set<string>(tutorialPuzzleBlueprintIds);

function hmac(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest();
}

function normalizedCatalogEntry(entry: PuzzlePrototypeCatalogEntry): ProductionGeneratorCatalogEntry {
  const sources = entry.sources.map((source) => {
    if (typeof source !== "string") throw new Error(`${entry.puzzleBlueprintId} contains a non-text research source.`);
    return source;
  });
  return {
    accessibilityModes: [...entry.accessibilityModalities],
    answerDerivation: entry.answerDerivation,
    answerFormat: entry.answerFormat,
    concept: entry.concept,
    decoys: [...entry.decoys],
    difficultyTier: entry.difficultyTier,
    expectedSolvePath: [...entry.expectedSolvePath],
    generatorVersion: entry.generatorVersion,
    hints: entry.hints.map((hint) => ({ kind: hint.kind, level: hint.level, text: hint.text })),
    playerFacingModalities: [...entry.playerFacingModalities],
    primaryFamily: entry.primaryFamily,
    puzzleBlueprintId: entry.puzzleBlueprintId,
    sources,
    title: entry.title,
  };
}

export function getPuzzleGeneratorReadinessCatalog(): PuzzleGeneratorReadinessEntry[] {
  return catalog.map((source) => {
    const base = normalizedCatalogEntry(source);
    const presentation = productionPresentationById(base.puzzleBlueprintId);
    const entry = presentation ? {
      ...base,
      accessibilityModes: [...presentation.accessibilityModes],
      answerFormat: presentation.answerFormat,
      concept: presentation.concept,
      expectedSolvePath: [...presentation.expectedSolvePath],
      generatorVersion: presentation.generatorVersion,
      hints: presentation.hints.map((hint) => ({ ...hint })),
      opening: presentation.opening,
      publicDescription: presentation.publicDescription,
      publicSlug: presentation.publicSlug,
      publicTitle: presentation.publicTitle,
    } : base;
    const production = tutorialIds.has(entry.puzzleBlueprintId);
    return {
      ...entry,
      implementationPath: production ? "apps/web/src/server/puzzle-tutorial-generators.ts" : null,
      productionStatus: production ? "PRODUCTION" : "PROTOTYPE_ONLY",
    };
  });
}

function productionEntryForVersion(puzzleBlueprintId: string, generatorVersion: string): ProductionGeneratorCatalogEntry | undefined {
  const baseSource = catalog.find((entry) => entry.puzzleBlueprintId === puzzleBlueprintId);
  if (!baseSource || !tutorialIds.has(puzzleBlueprintId)) return undefined;
  const base = normalizedCatalogEntry(baseSource);
  const presentation = productionPresentationById(puzzleBlueprintId);
  if (generatorVersion === "1.0.0") return base;
  if (generatorVersion !== presentation?.generatorVersion) return undefined;
  return {
    ...base,
    accessibilityModes: [...presentation.accessibilityModes],
    answerFormat: presentation.answerFormat,
    concept: presentation.concept,
    expectedSolvePath: [...presentation.expectedSolvePath],
    generatorVersion: presentation.generatorVersion,
    hints: presentation.hints.map((hint) => ({ ...hint })),
    opening: presentation.opening,
    publicDescription: presentation.publicDescription,
    publicSlug: presentation.publicSlug,
    publicTitle: presentation.publicTitle,
  };
}

export function getProductionGeneratorCatalog() {
  return getPuzzleGeneratorReadinessCatalog()
    .filter((entry) => entry.productionStatus === "PRODUCTION")
    .map(({ implementationPath, productionStatus, ...entry }) => {
      void implementationPath;
      void productionStatus;
      return entry;
    });
}

function carrierClues(carrier: GenericProductionCarrier): EncodedClue[] {
  if (carrier.kind === "TEXT_DOCUMENT_PAIR") return [...carrier.documentA, ...carrier.documentB];
  if (carrier.kind === "NUMERIC_LEDGER") return carrier.cells;
  if (carrier.kind === "VISUAL_SHAPE_LAYERS") return carrier.layers;
  if (carrier.kind === "SPATIAL_ROUTE_BOARD") return carrier.tiles;
  if (carrier.kind === "AUDIO_CAPTION_SEQUENCE") return carrier.events;
  if (carrier.kind === "LOGIC_CONSTRAINT_GRID") return carrier.constraints;
  if (carrier.kind === "RESEARCH_CLAIM_CHAIN") return carrier.claims;
  if (carrier.kind === "MECHANISM_REGISTER_BOARD") return carrier.registers;
  return carrier.pairs;
}

function solveGenericCarrier(carrier: GenericProductionCarrier) {
  const clues = [...carrierClues(carrier)].sort((left, right) => left.ordinal - right.ordinal);
  if (clues.some((clue, index) => clue.ordinal !== index) || new Set(clues.map((clue) => clue.ordinal)).size !== clues.length) return [];
  return [clues.map((clue) => String.fromCodePoint(clue.encodedValue - carrier.decodeOffset)).join("")];
}

export function generateProductionPuzzle(input: { generatorVersion: string; puzzleBlueprintId: string; seed: string; subjectKey: string }, secret: string): GeneratedProductionPuzzle {
  const readiness = getPuzzleGeneratorReadinessCatalog().find((candidate) => candidate.puzzleBlueprintId === input.puzzleBlueprintId);
  if (!readiness) throw new Error(`Unknown production Puzzle Blueprint: ${input.puzzleBlueprintId}`);
  if (readiness.productionStatus !== "PRODUCTION") {
    throw new Error(`${input.puzzleBlueprintId} has no authored production generator; its generic carrier is PROTOTYPE_ONLY.`);
  }
  const { implementationPath, productionStatus } = readiness;
  void implementationPath;
  void productionStatus;
  const entry = productionEntryForVersion(input.puzzleBlueprintId, input.generatorVersion);
  if (!entry) throw new Error(`${input.puzzleBlueprintId} does not implement immutable generator version ${input.generatorVersion}.`);
  if (!input.seed.trim() || !input.subjectKey.trim()) throw new Error("Production generation requires an authorized seed and subject context.");
  const tutorial = generateTutorialPuzzle({ generatorVersion: input.generatorVersion as TutorialGeneratorVersion, puzzleBlueprintId: entry.puzzleBlueprintId as (typeof tutorialPuzzleBlueprintIds)[number], seed: input.seed, subjectKey: input.subjectKey }, secret);
  return {
    accessibilityModes: entry.accessibilityModes,
    alternateSolutionsRejected: true,
    answerFormat: entry.answerFormat,
    canonicalSolution: tutorial.canonicalSolution,
    carrier: tutorial.carrier,
    concept: entry.concept,
    difficultyTier: entry.difficultyTier,
    expectedSolvePath: entry.expectedSolvePath,
    familyKind: productionFamilyKinds[entry.primaryFamily],
    generatorVersion: entry.generatorVersion,
    hints: entry.hints,
    instanceChecksum: tutorial.instanceChecksum,
    instanceId: tutorial.instanceId,
    liveRuntimeRecordsCreated: 0,
    playerFacingModalities: entry.playerFacingModalities,
    primaryFamily: entry.primaryFamily,
    proofDigest: tutorial.proofDigest,
    puzzleBlueprintId: entry.puzzleBlueprintId,
    timerStarted: false,
    title: entry.title,
    tutorialInstance: tutorial,
    uniqueSolution: true,
  };
}

export function solveProductionPuzzle(instance: GeneratedProductionPuzzle) {
  return instance.tutorialInstance ? solveTutorialPuzzle(instance.tutorialInstance) : solveGenericCarrier(instance.carrier as GenericProductionCarrier);
}

export function getPublicProductionPuzzle(instance: GeneratedProductionPuzzle): PlayerPuzzle {
  const presentation = productionPresentationById(instance.puzzleBlueprintId);
  if (!presentation || instance.generatorVersion !== presentation.generatorVersion) throw new Error("Only the current authored production version has a canonical player projection.");
  const carrier = instance.carrier;
  let artifact: PlayerPuzzle["artifact"];
  if (carrier.kind === "ORDINAL_CANCELLATION_MATRIX") {
    artifact = {
      matrixA: carrier.matrixA.map((row) => [...row]),
      matrixB: carrier.matrixB.map((row) => [...row]),
    };
  } else if (carrier.kind === "SET_AMBIGRAM") {
    const [memberCount, memberTotal, memberProduct] = carrier.resultChecksum.split(":").map(Number) as [number, number, number];
    artifact = {
      scopeCards: carrier.expressions.map((expression) => expression.replaceAll("UNION", "U").replaceAll("INTERSECT", "I")),
      seal: { memberCount, memberProduct, memberTotal },
      sets: { A: [...carrier.sets.A], B: [...carrier.sets.B], C: [...carrier.sets.C] },
    };
  } else if (carrier.kind === "TYPOGRAPHIC_QR_THRESHOLD") {
    artifact = { luminanceRows: carrier.luminanceRows.map((row) => [...row]) };
  } else if (carrier.kind === "MUSICAL_HEX_GRID" && carrier.scoreEvents) {
    artifact = { scoreEvents: carrier.scoreEvents.map((event) => ({ ...event })) };
  } else {
    throw new Error("A current production puzzle has no canonical player artifact.");
  }
  return {
    accessibilityModes: [...instance.accessibilityModes],
    artifact,
    hints: instance.hints.map((hint) => ({ level: hint.level, text: hint.text })),
    opening: presentation.opening,
    publicSlug: presentation.publicSlug,
    publicTitle: presentation.publicTitle,
  };
}

function normalize(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("en-US").replace(/\s*,\s*/, ",");
}

export function validateProductionPuzzle(instance: GeneratedProductionPuzzle, submission: string, secret: string) {
  const left = hmac(secret, `production-submission-v1|${instance.puzzleBlueprintId}|${normalize(submission)}`);
  const right = hmac(secret, `production-submission-v1|${instance.puzzleBlueprintId}|${normalize(instance.canonicalSolution)}`);
  return timingSafeEqual(left, right);
}

export const productionPreviewInput = (entry: ProductionGeneratorCatalogEntry, generation = 0) => ({
  generatorVersion: entry.generatorVersion,
  puzzleBlueprintId: entry.puzzleBlueprintId,
  seed: `admin-production-preview-v2:${generation}`,
  subjectKey: "ADMIN-PREVIEW",
});

export function getProductionPreviews(secret: string, generation = 0) {
  return getProductionGeneratorCatalog().map((entry) => getPublicProductionPuzzle(generateProductionPuzzle(productionPreviewInput(entry, generation), secret)));
}

export function getMemberPuzzleSummaries() {
  return productionPuzzleVersionCatalog.map((entry) => ({
    difficulty: "Initiate",
    publicDescription: entry.publicDescription,
    publicSlug: entry.publicSlug,
    publicTitle: entry.publicTitle,
  }));
}

export function validateProductionPreview(puzzleBlueprintId: string, submission: string, secret: string) {
  const readiness = getPuzzleGeneratorReadinessCatalog().find((candidate) => candidate.puzzleBlueprintId === puzzleBlueprintId);
  if (!readiness) throw new Error(`Unknown production Puzzle Blueprint: ${puzzleBlueprintId}`);
  if (readiness.productionStatus !== "PRODUCTION") {
    throw new Error(`${puzzleBlueprintId} has no authored production generator; its generic carrier is PROTOTYPE_ONLY.`);
  }
  const { implementationPath, productionStatus, ...entry } = readiness;
  void implementationPath;
  void productionStatus;
  const instance = generateProductionPuzzle(productionPreviewInput(entry), secret);
  return { correct: validateProductionPuzzle(instance, submission, secret), puzzleBlueprintId, timerStarted: false as const };
}
