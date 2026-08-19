import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const tutorialPuzzleBlueprintIds = ["PZB-011", "PZB-012", "PZB-037", "PZB-021"] as const;
export type TutorialPuzzleBlueprintId = (typeof tutorialPuzzleBlueprintIds)[number];

interface TutorialGenerationInput {
  generatorVersion: "1.0.0";
  puzzleBlueprintId: TutorialPuzzleBlueprintId;
  seed: string;
  subjectKey: string;
}

interface OrdinalCancellationCarrier {
  kind: "ORDINAL_CANCELLATION_MATRIX";
  instructions: string;
  matrixA: number[][];
  matrixB: number[][];
  screenReaderRows: string[];
}

interface SetAmbigramCarrier {
  kind: "SET_AMBIGRAM";
  instructions: string;
  sets: Record<"A" | "B" | "C", number[]>;
  expressions: string[];
  resultChecksum: string;
}

interface MusicalHexCarrier {
  kind: "MUSICAL_HEX_GRID";
  instructions: string;
  noteEvents: string[];
  textureGrid: string[];
}

interface TypographicQrCarrier {
  kind: "TYPOGRAPHIC_QR_THRESHOLD";
  instructions: string;
  luminanceRows: number[][];
  moduleMatrixTable: string[];
  routeAction: { method: "POST"; opaqueToken: string };
  threshold: number;
}

export type TutorialCarrier = OrdinalCancellationCarrier | SetAmbigramCarrier | MusicalHexCarrier | TypographicQrCarrier;

interface SymbolCard {
  ordinal: number;
  symbol: string;
}

export interface GeneratedTutorialPuzzle {
  accessibilityModes: string[];
  alternateSolutionsRejected: true;
  canonicalSolution: string;
  carrier: TutorialCarrier;
  generatorVersion: "1.0.0";
  instanceChecksum: string;
  instanceId: string;
  liveRuntimeRecordsCreated: 0;
  proofDigest: string;
  puzzleBlueprintId: TutorialPuzzleBlueprintId;
  routeStage?: { instructions: string; symbolCards: SymbolCard[] };
  routeToken?: string;
  timerStarted: false;
  uniqueSolution: true;
}

export interface PublicTutorialPuzzle {
  accessibilityModes: string[];
  carrier: TutorialCarrier;
  generatorVersion: "1.0.0";
  instanceChecksum: string;
  instanceId: string;
  liveRuntimeRecordsCreated: 0;
  puzzleBlueprintId: TutorialPuzzleBlueprintId;
  timerStarted: false;
}

const accessibilityModes: Record<TutorialPuzzleBlueprintId, string[]> = {
  "PZB-011": ["SCREEN_READER_DATA", "KEYBOARD_ONLY", "HIGH_CONTRAST", "PRINTABLE_WORKSHEET"],
  "PZB-012": ["SCREEN_READER_DATA", "KEYBOARD_ONLY", "HIGH_CONTRAST", "PRINTABLE_WORKSHEET"],
  "PZB-037": ["NOTATION", "CAPTIONS", "NOTE_EVENT_TABLE", "COLOR_LABELS", "TEXTURE_GRID"],
  "PZB-021": ["DIRECT_SIGNED_LINK_AFTER_EQUIVALENT_TRANSFORM", "MODULE_MATRIX_TABLE", "SCREEN_READER_ROUTE_ACTION", "HIGH_CONTRAST"],
};

function hmac(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest();
}

function stream(secret: string, context: string, length: number) {
  const chunks: Buffer[] = [];
  for (let counter = 0; Buffer.concat(chunks).length < length; counter += 1) {
    chunks.push(hmac(secret, `${context}|${counter}`));
  }
  return Buffer.concat(chunks).subarray(0, length);
}

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function generationContext(input: TutorialGenerationInput) {
  if (input.generatorVersion !== "1.0.0") throw new Error(`${input.puzzleBlueprintId} requires immutable generator version 1.0.0.`);
  if (!input.seed.trim() || !input.subjectKey.trim()) throw new Error("Tutorial generation requires an authorized seed and subject context.");
  return `witness-puzzle-production-v1|${input.puzzleBlueprintId}|${input.generatorVersion}|${input.seed}|${input.subjectKey}`;
}

function cancellationPuzzle(bytes: Buffer) {
  const target = bytes[0]! % 36;
  const matrixA: number[][] = [];
  const matrixB: number[][] = [];
  for (let row = 0; row < 6; row += 1) {
    const left: number[] = [];
    const right: number[] = [];
    for (let column = 0; column < 6; column += 1) {
      const index = row * 6 + column;
      const first = 1 + bytes[1 + index]! % 13;
      let second = 1 + bytes[37 + index]! % 13;
      const signedFirst = bytes[73 + index]! % 2 ? first : -first;
      let signedSecond = bytes[109 + index]! % 2 ? second : -second;
      if (index === target) signedSecond = -signedFirst;
      else if (signedFirst + signedSecond === 0) {
        second = second === 13 ? 12 : second + 1;
        signedSecond = signedSecond < 0 ? -second : second;
      }
      left.push(signedFirst);
      right.push(signedSecond);
    }
    matrixA.push(left);
    matrixB.push(right);
  }
  return {
    canonicalSolution: `${Math.floor(target / 6) + 1},${target % 6 + 1}`,
    carrier: {
      kind: "ORDINAL_CANCELLATION_MATRIX" as const,
      instructions: "Add corresponding signed alphabet offsets. Submit the one row,column coordinate whose sum is zero.",
      matrixA,
      matrixB,
      screenReaderRows: matrixA.map((row, rowIndex) => row.map((value, columnIndex) => `row ${rowIndex + 1} column ${columnIndex + 1}: ${value} plus ${matrixB[rowIndex]![columnIndex]}`).join("; ")),
    },
  };
}

const setExpressions = ["(A UNION B) INTERSECT C", "A UNION (B INTERSECT C)", "(A INTERSECT B) UNION C", "A INTERSECT (B UNION C)"] as const;

function union(left: number[], right: number[]) {
  return [...new Set([...left, ...right])].sort((a, b) => a - b);
}

function intersect(left: number[], right: number[]) {
  const rightValues = new Set(right);
  return left.filter((value) => rightValues.has(value)).sort((a, b) => a - b);
}

function evaluateSetExpression(index: number, sets: Record<"A" | "B" | "C", number[]>) {
  if (index === 0) return intersect(union(sets.A, sets.B), sets.C);
  if (index === 1) return union(sets.A, intersect(sets.B, sets.C));
  if (index === 2) return union(intersect(sets.A, sets.B), sets.C);
  return intersect(sets.A, union(sets.B, sets.C));
}

function setResultChecksum(values: number[]) {
  return `${values.length}:${values.reduce((sum, value) => sum + value, 0)}:${values.reduce((product, value) => product * value, 1)}`;
}

function setAmbigramPuzzle(bytes: Buffer) {
  const base = 2 + bytes[0]! % 20;
  const sets = { A: [base, base + 1], B: [base + 1, base + 2], C: [base + 2, base + 3] };
  const selected = bytes[1]! % setExpressions.length;
  const result = evaluateSetExpression(selected, sets);
  return {
    canonicalSolution: result.join("-"),
    carrier: {
      kind: "SET_AMBIGRAM" as const,
      instructions: "Treat U and I according to the displayed scope, evaluate each parse, and submit the ordered set whose checksum matches.",
      sets,
      expressions: [...setExpressions],
      resultChecksum: setResultChecksum(result),
    },
  };
}

function hexGroup(secret: string, context: string, index: number) {
  const bytes = hmac(secret, `${context}|hex-group|${index}`);
  return Array.from({ length: 6 }, (_, offset) => "ABCDEF"[bytes[offset]! % 6]).join("");
}

function musicalHexPuzzle(secret: string, context: string, bytes: Buffer) {
  const target = hexGroup(secret, context, -1);
  const repeatedAt = new Set([bytes[0]! % 42, 43 + bytes[1]! % 41, 85 + bytes[2]! % 43]);
  const used = new Set([target]);
  const groups: string[] = [];
  for (let index = 0; index < 128; index += 1) {
    if (repeatedAt.has(index)) {
      groups.push(target);
      continue;
    }
    let attempt = 0;
    let candidate = hexGroup(secret, context, index * 100 + attempt);
    while (used.has(candidate)) candidate = hexGroup(secret, context, index * 100 + ++attempt);
    used.add(candidate);
    groups.push(candidate);
  }
  return {
    canonicalSolution: target,
    carrier: {
      kind: "MUSICAL_HEX_GRID" as const,
      instructions: "Ignore G control markers, group note names A through F six at a time, and submit the sole repeated hexadecimal color.",
      noteEvents: groups.flatMap((group, index) => [...group, ...(index % 4 === 3 ? ["G"] : [])]),
      textureGrid: groups.map((group, index) => `cell ${index + 1}: ${group.split("").map((note) => "ABCDEF".indexOf(note) + 1).join("-")}`),
    },
  };
}

function setFinder(matrix: boolean[][], top: number, left: number) {
  for (let row = 0; row < 7; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const edge = row === 0 || row === 6 || column === 0 || column === 6;
      const center = row >= 2 && row <= 4 && column >= 2 && column <= 4;
      matrix[top + row]![left + column] = edge || center;
    }
  }
}

function typographicQrPuzzle(secret: string, context: string, bytes: Buffer) {
  const routeToken = hmac(secret, `${context}|signed-player-route`).toString("base64url").slice(0, 32);
  const matrixBytes = stream(secret, `${context}|module-matrix`, 441);
  const matrix = Array.from({ length: 21 }, (_, row) => Array.from({ length: 21 }, (_, column) => Boolean(matrixBytes[row * 21 + column]! & 1)));
  setFinder(matrix, 0, 0);
  setFinder(matrix, 0, 14);
  setFinder(matrix, 14, 0);
  const answerAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const canonicalSolution = Array.from({ length: 10 }, (_, index) => answerAlphabet[bytes[20 + index]! % answerAlphabet.length]).join("");
  const cards = Array.from(canonicalSolution, (symbol, ordinal) => ({ ordinal, symbol }));
  const rotation = 1 + bytes[31]! % 9;
  const symbolCards = [...cards.slice(rotation), ...cards.slice(0, rotation)];
  if (bytes[32]! % 2) symbolCards.reverse();
  return {
    canonicalSolution,
    routeStage: { instructions: "Order the symbol cards by their recovered module ordinal and submit the resulting sequence.", symbolCards },
    routeToken,
    carrier: {
      kind: "TYPOGRAPHIC_QR_THRESHOLD" as const,
      instructions: "Threshold the microtext luminance at 128 to recover the module matrix, then follow the signed player-bound route action.",
      luminanceRows: matrix.map((row, rowIndex) => row.map((dark, columnIndex) => (dark ? 34 : 222) + matrixBytes[(rowIndex * 21 + columnIndex + 97) % matrixBytes.length]! % 9)),
      moduleMatrixTable: matrix.map((row) => row.map((dark) => dark ? "#" : ".").join("")),
      routeAction: { method: "POST" as const, opaqueToken: routeToken },
      threshold: 128,
    },
  };
}

export function generateTutorialPuzzle(input: TutorialGenerationInput, secret: string): GeneratedTutorialPuzzle {
  const context = generationContext(input);
  const bytes = stream(secret, context, 192);
  const generated = input.puzzleBlueprintId === "PZB-011" ? cancellationPuzzle(bytes)
    : input.puzzleBlueprintId === "PZB-012" ? setAmbigramPuzzle(bytes)
      : input.puzzleBlueprintId === "PZB-037" ? musicalHexPuzzle(secret, context, bytes)
        : typographicQrPuzzle(secret, context, bytes);
  const publicCore = {
    accessibilityModes: accessibilityModes[input.puzzleBlueprintId],
    carrier: generated.carrier,
    generatorVersion: input.generatorVersion,
    instanceId: hmac(secret, `${context}|instance`).toString("hex").slice(0, 24),
    liveRuntimeRecordsCreated: 0 as const,
    puzzleBlueprintId: input.puzzleBlueprintId,
    timerStarted: false as const,
  };
  const instanceChecksum = checksum(publicCore);
  const solutions = solveCarrier(generated.carrier, "routeStage" in generated ? generated.routeStage : undefined);
  if (solutions.length !== 1 || solutions[0] !== generated.canonicalSolution) throw new Error(`${input.puzzleBlueprintId} did not produce exactly one canonical solution.`);
  return {
    ...publicCore,
    ...generated,
    alternateSolutionsRejected: true,
    instanceChecksum,
    proofDigest: hmac(secret, `${context}|unique|${generated.canonicalSolution}|${instanceChecksum}`).toString("hex"),
    uniqueSolution: true,
  };
}

function solveCarrier(carrier: TutorialCarrier, routeStage?: { symbolCards: SymbolCard[] }) {
  if (carrier.kind === "ORDINAL_CANCELLATION_MATRIX") {
    const solutions: string[] = [];
    for (let row = 0; row < carrier.matrixA.length; row += 1) {
      for (let column = 0; column < carrier.matrixA[row]!.length; column += 1) {
        if (carrier.matrixA[row]![column]! + carrier.matrixB[row]![column]! === 0) solutions.push(`${row + 1},${column + 1}`);
      }
    }
    return solutions;
  }
  if (carrier.kind === "SET_AMBIGRAM") {
    return carrier.expressions.map((_, index) => evaluateSetExpression(index, carrier.sets)).filter((result) => setResultChecksum(result) === carrier.resultChecksum).map((result) => result.join("-"));
  }
  if (carrier.kind === "MUSICAL_HEX_GRID") {
    const groups: string[] = [];
    let current = "";
    for (const note of carrier.noteEvents) {
      if (note === "G") continue;
      current += note;
      if (current.length === 6) { groups.push(current); current = ""; }
    }
    const counts = new Map<string, number>();
    for (const group of groups) counts.set(group, (counts.get(group) ?? 0) + 1);
    return [...counts].filter(([, count]) => count > 1).map(([group]) => group);
  }
  if (!routeStage) return [];
  return [[...routeStage.symbolCards].sort((left, right) => left.ordinal - right.ordinal).map((card) => card.symbol).join("")];
}

export function solveTutorialPuzzle(instance: GeneratedTutorialPuzzle) {
  return solveCarrier(instance.carrier, instance.routeStage);
}

export function getPublicTutorialPuzzle(instance: GeneratedTutorialPuzzle): PublicTutorialPuzzle {
  return {
    accessibilityModes: [...instance.accessibilityModes],
    carrier: instance.carrier,
    generatorVersion: instance.generatorVersion,
    instanceChecksum: instance.instanceChecksum,
    instanceId: instance.instanceId,
    liveRuntimeRecordsCreated: 0,
    puzzleBlueprintId: instance.puzzleBlueprintId,
    timerStarted: false,
  };
}

function normalizeSubmission(instance: GeneratedTutorialPuzzle, submission: string) {
  const normalized = submission.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("en-US");
  return instance.puzzleBlueprintId === "PZB-011" ? normalized.replace(/\s*,\s*/, ",") : normalized;
}

export function validateTutorialPuzzle(instance: GeneratedTutorialPuzzle, submission: string, secret: string) {
  const left = hmac(secret, `tutorial-submission-v1|${normalizeSubmission(instance, submission)}`);
  const right = hmac(secret, `tutorial-submission-v1|${normalizeSubmission(instance, instance.canonicalSolution)}`);
  return timingSafeEqual(left, right);
}

export function resolveTutorialRoute(instance: GeneratedTutorialPuzzle, routeToken: string, secret: string) {
  if (instance.puzzleBlueprintId !== "PZB-021" || !instance.routeToken || !instance.routeStage) throw new Error("This tutorial has no signed route token.");
  const submitted = hmac(secret, `tutorial-route-token-v1|${routeToken}`);
  const expected = hmac(secret, `tutorial-route-token-v1|${instance.routeToken}`);
  if (!timingSafeEqual(submitted, expected)) throw new Error("The signed tutorial route token is invalid.");
  return { instructions: instance.routeStage.instructions, symbolCards: instance.routeStage.symbolCards.map((card) => ({ ...card })) };
}

function adminPreviewInput(puzzleBlueprintId: TutorialPuzzleBlueprintId): TutorialGenerationInput {
  return { generatorVersion: "1.0.0", puzzleBlueprintId, seed: "admin-preview-v1", subjectKey: "ADMIN-PREVIEW" };
}

export function getTutorialProductionPreviews(secret: string) {
  return tutorialPuzzleBlueprintIds.map((puzzleBlueprintId) => getPublicTutorialPuzzle(generateTutorialPuzzle(adminPreviewInput(puzzleBlueprintId), secret)));
}

export function validateTutorialProductionPreview(puzzleBlueprintId: TutorialPuzzleBlueprintId, answer: string, secret: string) {
  const instance = generateTutorialPuzzle(adminPreviewInput(puzzleBlueprintId), secret);
  return { correct: validateTutorialPuzzle(instance, answer, secret), puzzleBlueprintId, timerStarted: false as const };
}

export function resolveTutorialProductionPreviewRoute(puzzleBlueprintId: "PZB-021", routeToken: string, secret: string) {
  return resolveTutorialRoute(generateTutorialPuzzle(adminPreviewInput(puzzleBlueprintId), secret), routeToken, secret);
}
