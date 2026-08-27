import {
  generateProductionPuzzle,
  getProductionGeneratorCatalog,
  getPublicProductionPuzzle,
  productionPreviewInput,
  validateProductionPuzzle,
  type GeneratedProductionPuzzle,
  type PublicProductionPuzzle,
} from "./puzzle-production-generators";
import { resolveTutorialRoute } from "./puzzle-tutorial-generators";

export const productionPuzzleBlueprintIds = ["PZB-011", "PZB-012", "PZB-021", "PZB-037"] as const;
export type ProductionPuzzleBlueprintId = (typeof productionPuzzleBlueprintIds)[number];

export type ProductionPlayerSubmission =
  | { kind: "bitmap-code"; markedCoordinates: Array<{ column: number; row: number }>; value: string }
  | { kind: "coordinate"; row: number; column: number }
  | { kind: "set"; members: number[] }
  | { kind: "hex"; value: string }
  | { kind: "ordered-symbols"; symbols: string[]; threshold: number };

export interface PublicSymbolCard {
  cardId: string;
  notchCount: number;
  symbol: string;
}

export interface PublicRouteStage {
  cards: PublicSymbolCard[];
  instructions: string;
}

export interface OwnerPuzzleQaMetadata {
  accessibilityModes: string[];
  authoredConcept: string;
  difficultyTier: string;
  expectedAnswerFormat: string;
  family: string;
  generatorVersion: string;
  hints: Array<{ kind: string; level: number; text: string }>;
  instanceIdentity: string;
  intendedSolvePath: string[];
  puzzleBlueprintId: ProductionPuzzleBlueprintId;
  publicTitle: string;
  title: string;
}

export interface ProductionQaSandbox {
  generation: number;
  ownerQa: OwnerPuzzleQaMetadata;
  playerPuzzle: PublicProductionPuzzle;
}

const intendedSolvePaths: Record<ProductionPuzzleBlueprintId, string[]> = {
  "PZB-011": [
    "Compare the two signed records at the same row and column.",
    "Mark every corresponding pair that cancels exactly without using a precomputed sum.",
    "Read the six glyphs drawn by the complete cancellation mask and submit both the code and working mask.",
  ],
  "PZB-012": [
    "Read U as union and I as intersection only where the scope cards use them as operators.",
    "Evaluate the four scoped readings against sets A, B, and C.",
    "Match the resulting set to the wax-seal count, total, and product, then submit its ordered members.",
  ],
  "PZB-021": [
    "Treat the microtext field as light and dark density rather than prose.",
    "Adjust the threshold until the three finder marks and the full module pattern resolve.",
    "Continue through the recovered mark, then order the symbol cards by their visible notch counts and submit the sequence.",
  ],
  "PZB-037": [
    "Play or inspect the score and track the written note names.",
    "Treat G as a phrase divider and group A through F six at a time as hexadecimal colors.",
    "Render the 32 by 4 field, read the six darker glyphs, and submit them.",
  ],
};

function assertGeneration(generation: number) {
  if (!Number.isSafeInteger(generation) || generation < 0 || generation > 10_000) throw new Error("Production preview generation is invalid.");
}

function entryFor(puzzleBlueprintId: string) {
  if (!productionPuzzleBlueprintIds.includes(puzzleBlueprintId as ProductionPuzzleBlueprintId)) throw new Error(`Unknown production Puzzle Blueprint: ${puzzleBlueprintId}`);
  const entry = getProductionGeneratorCatalog().find((candidate) => candidate.puzzleBlueprintId === puzzleBlueprintId);
  if (!entry) throw new Error(`${puzzleBlueprintId} is not an authored production Puzzle.`);
  return entry;
}

function previewInstance(puzzleBlueprintId: ProductionPuzzleBlueprintId, generation: number, secret: string) {
  assertGeneration(generation);
  const entry = entryFor(puzzleBlueprintId);
  return { entry, instance: generateProductionPuzzle(productionPreviewInput(entry, generation), secret) };
}

function thresholdMatches(instance: GeneratedProductionPuzzle, threshold: number) {
  if (!Number.isSafeInteger(threshold) || threshold < 0 || threshold > 255) return false;
  const tutorial = instance.tutorialInstance;
  if (!tutorial || tutorial.carrier.kind !== "TYPOGRAPHIC_QR_THRESHOLD") return false;
  const carrier = tutorial.carrier;
  const observed = carrier.luminanceRows.map((row) => row.map((value) => value < threshold ? "#" : ".").join(""));
  return observed.every((row, index) => row === carrier.moduleMatrixTable[index]);
}

export function createProductionQaSandbox(puzzleBlueprintId: ProductionPuzzleBlueprintId, generation: number, secret: string): ProductionQaSandbox {
  const { entry, instance } = previewInstance(puzzleBlueprintId, generation, secret);
  return {
    generation,
    ownerQa: {
      accessibilityModes: [...entry.accessibilityModes],
      authoredConcept: entry.concept,
      difficultyTier: entry.difficultyTier,
      expectedAnswerFormat: entry.answerFormat,
      family: entry.primaryFamily,
      generatorVersion: entry.generatorVersion,
      hints: entry.hints.map((hint) => ({ ...hint })),
      instanceIdentity: instance.instanceId,
      intendedSolvePath: intendedSolvePaths[puzzleBlueprintId],
      puzzleBlueprintId,
      publicTitle: entry.publicTitle ?? entry.title,
      title: entry.title,
    },
    playerPuzzle: getPublicProductionPuzzle(instance),
  };
}

export function getProductionQaSandboxes(secret: string) {
  return productionPuzzleBlueprintIds.map((puzzleBlueprintId) => createProductionQaSandbox(puzzleBlueprintId, 0, secret));
}

export function resolveProductionPreviewRoute(puzzleBlueprintId: "PZB-021", generation: number, threshold: number, secret: string): PublicRouteStage {
  const { instance } = previewInstance(puzzleBlueprintId, generation, secret);
  return resolveProductionInstanceRoute(instance, threshold, secret);
}

export function resolveProductionInstanceRoute(instance: GeneratedProductionPuzzle, threshold: number, secret: string): PublicRouteStage {
  if (instance.puzzleBlueprintId !== "PZB-021") throw new Error("The recovered passage is not available for this puzzle.");
  if (!thresholdMatches(instance, threshold)) throw new Error("That threshold has not recovered the complete mark yet.");
  const tutorial = instance.tutorialInstance!;
  const stage = resolveTutorialRoute(tutorial, tutorial.routeToken!, secret);
  return {
    cards: stage.symbolCards.map((card) => ({ cardId: `card-${card.ordinal + 1}`, notchCount: card.ordinal + 1, symbol: card.symbol })),
    instructions: "Order the recovered symbol cards from one notch upward, then check the resulting sequence.",
  };
}

function submissionValue(instance: GeneratedProductionPuzzle, submission: ProductionPlayerSubmission) {
  if (instance.puzzleBlueprintId === "PZB-011" && instance.generatorVersion === "1.1.0" && submission.kind === "bitmap-code") {
    const carrier = instance.carrier;
    if (carrier.kind !== "ORDINAL_CANCELLATION_MATRIX" || !/^[A-H2-9]{6}$/i.test(submission.value)) return null;
    const expected = new Set<string>();
    for (let row = 0; row < carrier.matrixA.length; row += 1) {
      for (let column = 0; column < carrier.matrixA[row]!.length; column += 1) {
        if (carrier.matrixA[row]![column]! + carrier.matrixB[row]![column]! === 0) expected.add(`${row + 1},${column + 1}`);
      }
    }
    const observed = new Set<string>();
    for (const coordinate of submission.markedCoordinates) {
      if (!Number.isSafeInteger(coordinate.row) || !Number.isSafeInteger(coordinate.column) || coordinate.row < 1 || coordinate.row > carrier.matrixA.length || coordinate.column < 1 || coordinate.column > carrier.matrixA[0]!.length) return null;
      observed.add(`${coordinate.row},${coordinate.column}`);
    }
    if (observed.size !== submission.markedCoordinates.length || observed.size !== expected.size || [...expected].some((coordinate) => !observed.has(coordinate))) return null;
    return submission.value;
  }
  if (instance.puzzleBlueprintId === "PZB-011" && submission.kind === "coordinate") {
    const carrier = instance.carrier;
    if (carrier.kind !== "ORDINAL_CANCELLATION_MATRIX" || !Number.isSafeInteger(submission.row) || !Number.isSafeInteger(submission.column) || submission.row < 1 || submission.column < 1 || submission.row > carrier.matrixA.length || submission.column > carrier.matrixA[0]!.length) return null;
    return `${submission.row},${submission.column}`;
  }
  if (instance.puzzleBlueprintId === "PZB-012" && submission.kind === "set") {
    if (!submission.members.length || submission.members.some((member) => !Number.isSafeInteger(member)) || new Set(submission.members).size !== submission.members.length) return null;
    return [...submission.members].sort((left, right) => left - right).join("-");
  }
  if (instance.puzzleBlueprintId === "PZB-037" && submission.kind === "hex") {
    const normalized = submission.value.normalize("NFKC").trim().toLocaleUpperCase("en-US");
    return /^[A-F]{6}$/.test(normalized) ? normalized : null;
  }
  if (instance.puzzleBlueprintId === "PZB-021" && submission.kind === "ordered-symbols") {
    if (!thresholdMatches(instance, submission.threshold) || submission.symbols.length !== 10 || submission.symbols.some((symbol) => !/^[A-Z2-9]$/.test(symbol))) return null;
    return submission.symbols.join("");
  }
  return null;
}

export function validateProductionPreviewSubmission(puzzleBlueprintId: ProductionPuzzleBlueprintId, generation: number, submission: ProductionPlayerSubmission, secret: string) {
  const { instance } = previewInstance(puzzleBlueprintId, generation, secret);
  return { ...validateProductionInstanceSubmission(instance, submission, secret), puzzleBlueprintId };
}

export function validateProductionInstanceSubmission(instance: GeneratedProductionPuzzle, submission: ProductionPlayerSubmission, secret: string) {
  const value = submissionValue(instance, submission);
  return {
    correct: value !== null && validateProductionPuzzle(instance, value, secret),
    timerStarted: false as const,
  };
}

export function revealProductionPreviewSolution(puzzleBlueprintId: ProductionPuzzleBlueprintId, generation: number, secret: string) {
  const { entry, instance } = previewInstance(puzzleBlueprintId, generation, secret);
  return {
    expectedAnswerFormat: entry.answerFormat,
    expectedSolution: instance.canonicalSolution,
    intendedSolvePath: intendedSolvePaths[puzzleBlueprintId],
    puzzleBlueprintId,
  };
}
