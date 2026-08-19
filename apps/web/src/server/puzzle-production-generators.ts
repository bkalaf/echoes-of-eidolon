import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import catalogSource from "../../data/puzzles/puzzle-prototype-catalog-70.json";
import { loadPuzzlePrototypeCatalog, type PuzzlePrototypeCatalogEntry } from "../domain/puzzle-prototype-catalog";
import { generateTutorialPuzzle, getPublicTutorialPuzzle, solveTutorialPuzzle, tutorialPuzzleBlueprintIds, type GeneratedTutorialPuzzle, type TutorialCarrier } from "./puzzle-tutorial-generators";

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

interface EncodedClue {
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
  puzzleBlueprintId: string;
  sources: string[];
  title: string;
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
  tutorialInstance?: GeneratedTutorialPuzzle;
  uniqueSolution: true;
}

export type PublicProductionPuzzle = Omit<GeneratedProductionPuzzle, "alternateSolutionsRejected" | "canonicalSolution" | "proofDigest" | "tutorialInstance" | "uniqueSolution">;

const catalog = loadPuzzlePrototypeCatalog(catalogSource);
const tutorialIds = new Set<string>(tutorialPuzzleBlueprintIds);
const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const phraseLeft = ["EMBER", "LANTERN", "RIVER", "SILVER", "HOLLOW", "MORNING", "CINDER", "GLASS"];
const phraseRight = ["GATE", "ARCHIVE", "COMPASS", "BRIDGE", "ORCHARD", "HARBOR", "THREAD", "CROWN"];

function hmac(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest();
}

function byteStream(secret: string, context: string, length: number) {
  const result: number[] = [];
  for (let counter = 0; result.length < length; counter += 1) result.push(...hmac(secret, `${context}|${counter}`));
  return Buffer.from(result.slice(0, length));
}

function symbols(bytes: Buffer, length: number) {
  return Array.from({ length }, (_, index) => alpha[bytes[index % bytes.length]! % alpha.length]).join("");
}

function digits(bytes: Buffer, length: number) {
  return Array.from({ length }, (_, index) => String(bytes[index % bytes.length]! % 10)).join("");
}

function deriveAnswer(format: string, bytes: Buffer) {
  if (format === "SIX_DIGIT_CODE") return digits(bytes, 6);
  if (format === "EIGHT_CHARACTER_ALPHANUMERIC") return symbols(bytes, 8);
  if (format === "ORDERED_SYMBOL_SEQUENCE") return symbols(bytes, 10);
  if (format === "SHORT_PHRASE") return `${phraseLeft[bytes[0]! % phraseLeft.length]} ${phraseRight[bytes[1]! % phraseRight.length]}`;
  if (format === "COORDINATE") return `${1 + bytes[0]! % 32},${1 + bytes[1]! % 32}`;
  if (format === "OBJECT_ARRANGEMENT_SIGNATURE") return symbols(bytes, 12);
  if (format === "ORDERED_ROUTE") return Array.from({ length: 8 }, (_, index) => directions[bytes[index]! % directions.length]).join("-");
  if (format === "SIXTEEN_CHARACTER_SEQUENCE") return symbols(bytes, 16);
  if (format === "SIX_CHARACTER_HEXADECIMAL") return bytes.toString("hex").slice(0, 6).toUpperCase();
  if (format === "ROUTE_SIGNATURE_16") return Array.from({ length: 16 }, (_, index) => directions[bytes[index]! % directions.length]).join("");
  if (format === "TWENTY_DIGIT_YEAR_SEQUENCE") return Array.from({ length: 5 }, (_, index) => String(1000 + (bytes[index]! * 7 + bytes[index + 5]!) % 1026).padStart(4, "0")).join("");
  if (format === "INTEGER_PIECES_REMAINING") return String(4 + bytes[0]! % 29);
  throw new Error(`Unsupported production answer format: ${format}`);
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

export function getProductionGeneratorCatalog() {
  return catalog.map(normalizedCatalogEntry);
}

function shuffledClues(solution: string, offset: number, bytes: Buffer) {
  const clues = Array.from(solution, (character, ordinal) => ({ encodedValue: character.codePointAt(0)! + offset, ordinal }));
  for (let index = clues.length - 1; index > 0; index -= 1) {
    const target = bytes[(index + 80) % bytes.length]! % (index + 1);
    [clues[index], clues[target]] = [clues[target]!, clues[index]!];
  }
  return clues;
}

function buildCarrier(entry: ProductionGeneratorCatalogEntry, solution: string, bytes: Buffer): GenericProductionCarrier {
  const offset = 5 + bytes[60]! % 37;
  const clues = shuffledClues(solution, offset, bytes);
  const instructions = `${entry.concept} Apply the authored solve method: ${entry.answerDerivation} For this deterministic carrier, order the uniquely numbered ${entry.primaryFamily.toLowerCase().replaceAll("_", " ")} clues, subtract the declared offset, and convert each value to its Unicode character.`;
  if (entry.primaryFamily === "TEXT_LANGUAGE_LITERARY") return { kind: "TEXT_DOCUMENT_PAIR", decodeOffset: offset, documentA: clues.filter((_, index) => index % 2 === 0), documentB: clues.filter((_, index) => index % 2 === 1), instructions };
  if (entry.primaryFamily === "CRYPTO_NUMERIC_DATA") return { kind: "NUMERIC_LEDGER", decodeOffset: offset, cells: clues, instructions };
  if (entry.primaryFamily === "VISUAL_COLOR_OPTICAL") return { kind: "VISUAL_SHAPE_LAYERS", decodeOffset: offset, instructions, layers: clues.map((clue, index) => ({ ...clue, shape: ["circle", "triangle", "square"][index % 3]!, texture: ["solid", "striped", "dotted"][index % 3]! })) };
  if (entry.primaryFamily === "SPATIAL_FOLDING_GEOMETRY") return { kind: "SPATIAL_ROUTE_BOARD", decodeOffset: offset, instructions, tiles: clues.map((clue) => ({ ...clue, keyboardLabel: `Move to ordinal ${clue.ordinal + 1}` })) };
  if (entry.primaryFamily === "AUDIO_MUSIC_SPECTRAL") return { kind: "AUDIO_CAPTION_SEQUENCE", decodeOffset: offset, instructions, events: clues.map((clue, index) => ({ ...clue, caption: `Event ${clue.ordinal + 1}, encoded value ${clue.encodedValue}`, note: "ABCDEFG"[index % 7]! })) };
  if (entry.primaryFamily === "LOGIC_CONSTRAINT") return { kind: "LOGIC_CONSTRAINT_GRID", decodeOffset: offset, instructions, constraints: clues.map((clue) => ({ ...clue, relation: `ordinal = ${clue.ordinal + 1}` })) };
  if (entry.primaryFamily === "HISTORICAL_RESEARCH") {
    if (entry.sources.length === 0) throw new Error(`${entry.puzzleBlueprintId} requires declared research sources.`);
    return { kind: "RESEARCH_CLAIM_CHAIN", decodeOffset: offset, instructions, claims: clues.map((clue, index) => ({ ...clue, citation: entry.sources[index % entry.sources.length]!, claimLabel: `Claim ${clue.ordinal + 1}` })) };
  }
  if (entry.primaryFamily === "CONSTRUCTION_SIMULATION") return { kind: "MECHANISM_REGISTER_BOARD", decodeOffset: offset, instructions, registers: clues.map((clue) => ({ ...clue, control: `Set register ${clue.ordinal + 1}` })) };
  return { kind: "CROSS_MODAL_SIGNAL_PAIRS", decodeOffset: offset, instructions, pairs: clues.map((clue, index) => ({ ...clue, audioCaption: `Pulse ${index + 1}`, visualCue: ["line", "dot", "cross"][index % 3]! })) };
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

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function generateProductionPuzzle(input: { generatorVersion: string; puzzleBlueprintId: string; seed: string; subjectKey: string }, secret: string): GeneratedProductionPuzzle {
  const entry = getProductionGeneratorCatalog().find((candidate) => candidate.puzzleBlueprintId === input.puzzleBlueprintId);
  if (!entry) throw new Error(`Unknown production Puzzle Blueprint: ${input.puzzleBlueprintId}`);
  if (input.generatorVersion !== entry.generatorVersion) throw new Error(`${entry.puzzleBlueprintId} requires immutable generator version ${entry.generatorVersion}.`);
  if (!input.seed.trim() || !input.subjectKey.trim()) throw new Error("Production generation requires an authorized seed and subject context.");
  const context = `witness-puzzle-production-catalog-v1|${entry.puzzleBlueprintId}|${entry.generatorVersion}|${input.seed}|${input.subjectKey}`;
  if (tutorialIds.has(entry.puzzleBlueprintId)) {
    const tutorial = generateTutorialPuzzle({ generatorVersion: "1.0.0", puzzleBlueprintId: entry.puzzleBlueprintId as (typeof tutorialPuzzleBlueprintIds)[number], seed: input.seed, subjectKey: input.subjectKey }, secret);
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
      tutorialInstance: tutorial,
      uniqueSolution: true,
    };
  }
  const bytes = byteStream(secret, context, 192);
  const canonicalSolution = deriveAnswer(entry.answerFormat, bytes);
  const carrier = buildCarrier(entry, canonicalSolution, bytes);
  const publicCore = { accessibilityModes: entry.accessibilityModes, answerFormat: entry.answerFormat, carrier, concept: entry.concept, difficultyTier: entry.difficultyTier, expectedSolvePath: entry.expectedSolvePath, familyKind: productionFamilyKinds[entry.primaryFamily], generatorVersion: entry.generatorVersion, hints: entry.hints, instanceId: hmac(secret, `${context}|instance`).toString("hex").slice(0, 24), liveRuntimeRecordsCreated: 0 as const, playerFacingModalities: entry.playerFacingModalities, primaryFamily: entry.primaryFamily, puzzleBlueprintId: entry.puzzleBlueprintId, timerStarted: false as const };
  const instanceChecksum = checksum(publicCore);
  const solutions = solveGenericCarrier(carrier);
  if (solutions.length !== 1 || solutions[0] !== canonicalSolution) throw new Error(`${entry.puzzleBlueprintId} did not produce exactly one canonical solution.`);
  return { ...publicCore, alternateSolutionsRejected: true, canonicalSolution, instanceChecksum, proofDigest: hmac(secret, `${context}|bijective-proof|${canonicalSolution}|${instanceChecksum}`).toString("hex"), uniqueSolution: true };
}

export function solveProductionPuzzle(instance: GeneratedProductionPuzzle) {
  return instance.tutorialInstance ? solveTutorialPuzzle(instance.tutorialInstance) : solveGenericCarrier(instance.carrier as GenericProductionCarrier);
}

export function getPublicProductionPuzzle(instance: GeneratedProductionPuzzle): PublicProductionPuzzle {
  if (instance.tutorialInstance) {
    const tutorial = getPublicTutorialPuzzle(instance.tutorialInstance);
    return { accessibilityModes: instance.accessibilityModes, answerFormat: instance.answerFormat, carrier: tutorial.carrier, concept: instance.concept, difficultyTier: instance.difficultyTier, expectedSolvePath: instance.expectedSolvePath, familyKind: instance.familyKind, generatorVersion: instance.generatorVersion, hints: instance.hints, instanceChecksum: tutorial.instanceChecksum, instanceId: tutorial.instanceId, liveRuntimeRecordsCreated: 0, playerFacingModalities: instance.playerFacingModalities, primaryFamily: instance.primaryFamily, puzzleBlueprintId: instance.puzzleBlueprintId, timerStarted: false };
  }
  return { accessibilityModes: [...instance.accessibilityModes], answerFormat: instance.answerFormat, carrier: instance.carrier, concept: instance.concept, difficultyTier: instance.difficultyTier, expectedSolvePath: [...instance.expectedSolvePath], familyKind: instance.familyKind, generatorVersion: instance.generatorVersion, hints: instance.hints.map((hint) => ({ ...hint })), instanceChecksum: instance.instanceChecksum, instanceId: instance.instanceId, liveRuntimeRecordsCreated: 0, playerFacingModalities: [...instance.playerFacingModalities], primaryFamily: instance.primaryFamily, puzzleBlueprintId: instance.puzzleBlueprintId, timerStarted: false };
}

function normalize(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("en-US").replace(/\s*,\s*/, ",");
}

export function validateProductionPuzzle(instance: GeneratedProductionPuzzle, submission: string, secret: string) {
  const left = hmac(secret, `production-submission-v1|${instance.puzzleBlueprintId}|${normalize(submission)}`);
  const right = hmac(secret, `production-submission-v1|${instance.puzzleBlueprintId}|${normalize(instance.canonicalSolution)}`);
  return timingSafeEqual(left, right);
}

const productionPreviewInput = (entry: ProductionGeneratorCatalogEntry) => ({
  generatorVersion: entry.generatorVersion,
  puzzleBlueprintId: entry.puzzleBlueprintId,
  seed: "admin-production-preview-v1",
  subjectKey: "ADMIN-PREVIEW",
});

export function getProductionPreviews(secret: string) {
  return getProductionGeneratorCatalog().map((entry) => getPublicProductionPuzzle(generateProductionPuzzle(productionPreviewInput(entry), secret)));
}

export function validateProductionPreview(puzzleBlueprintId: string, submission: string, secret: string) {
  const entry = getProductionGeneratorCatalog().find((candidate) => candidate.puzzleBlueprintId === puzzleBlueprintId);
  if (!entry) throw new Error(`Unknown production Puzzle Blueprint: ${puzzleBlueprintId}`);
  const instance = generateProductionPuzzle(productionPreviewInput(entry), secret);
  return { correct: validateProductionPuzzle(instance, submission, secret), puzzleBlueprintId, timerStarted: false as const };
}
