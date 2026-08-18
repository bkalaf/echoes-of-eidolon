import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import catalogSource from "../../data/puzzles/puzzle-prototype-catalog-70.json";
import {
  getPublicPuzzlePrototypeCatalog,
  loadPuzzlePrototypeCatalog,
  type PuzzlePrototypeCatalogEntry,
  type PuzzlePrototypeKind,
} from "../domain/puzzle-prototype-catalog";
import { getAuthEnv } from "./env";

const catalog = loadPuzzlePrototypeCatalog(catalogSource);
const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const phraseLeft = ["EMBER", "LANTERN", "RIVER", "SILVER", "HOLLOW", "MORNING", "CINDER", "GLASS"];
const phraseRight = ["GATE", "ARCHIVE", "COMPASS", "BRIDGE", "ORCHARD", "HARBOR", "THREAD", "CROWN"];
const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export const puzzlePrototypeSubmissionSchema = z.object({
  operation: z.literal("validate-prototype"),
  puzzleBlueprintId: z.string().regex(/^PZB-\d{3}$/),
  answer: z.string().trim().min(1).max(2_000),
}).strict();

function hmac(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest();
}

function digits(bytes: Buffer, length: number) {
  return Array.from({ length }, (_, index) => String(bytes[index % bytes.length]! % 10)).join("");
}

function symbols(bytes: Buffer, length: number) {
  return Array.from({ length }, (_, index) => alpha[bytes[index % bytes.length]! % alpha.length]).join("");
}

export function derivePuzzlePrototypeAnswer(entry: PuzzlePrototypeCatalogEntry, secret: string): string {
  const bytes = hmac(secret, `witness-puzzle-prototype-answer-v1|${entry.puzzleBlueprintId}|${entry.generatorVersion}`);
  switch (entry.answerFormat) {
    case "SIX_DIGIT_CODE": return digits(bytes, 6);
    case "SIX_CHARACTER_HEXADECIMAL": return bytes.toString("hex").slice(0, 6).toUpperCase();
    case "EIGHT_CHARACTER_ALPHANUMERIC": return symbols(bytes, 8);
    case "SIXTEEN_CHARACTER_SEQUENCE": return symbols(bytes, 16);
    case "ORDERED_SYMBOL_SEQUENCE": return symbols(bytes, 10);
    case "OBJECT_ARRANGEMENT_SIGNATURE": return symbols(bytes, 12);
    case "COORDINATE": return `${1 + bytes[0]! % 32},${1 + bytes[1]! % 32}`;
    case "ORDERED_ROUTE": return Array.from({ length: 8 }, (_, index) => directions[bytes[index]! % directions.length]).join("-");
    case "ROUTE_SIGNATURE_16": return Array.from({ length: 16 }, (_, index) => directions[bytes[index]! % directions.length]).join("");
    case "SHORT_PHRASE": return `${phraseLeft[bytes[0]! % phraseLeft.length]} ${phraseRight[bytes[1]! % phraseRight.length]}`;
    case "TWENTY_DIGIT_YEAR_SEQUENCE": return Array.from({ length: 5 }, (_, index) => String(1000 + (bytes[index]! * 7 + bytes[index + 5]!) % 1026).padStart(4, "0")).join("");
    case "INTEGER_PIECES_REMAINING": return String(4 + bytes[0]! % 29);
    default: throw new Error(`Unsupported Puzzle prototype answer format: ${entry.answerFormat}`);
  }
}

const clueLabels: Record<PuzzlePrototypeKind, string> = {
  TEXT_COMPARE: "margin ordinal",
  DATA_TRANSFORM: "ledger cell",
  VISUAL_LAYER: "shape layer",
  SPATIAL_BOARD: "path tile",
  AUDIO_SEQUENCE: "captioned tone",
  CONSTRAINT_GRID: "constraint row",
  SOURCE_CHAIN: "source claim",
  MECHANISM_BOARD: "output register",
  CROSS_MODAL: "paired signal",
};

export function createPuzzlePrototypeChallenge(entry: PuzzlePrototypeCatalogEntry, secret: string) {
  const answer = derivePuzzlePrototypeAnswer(entry, secret);
  const bytes = hmac(secret, `witness-puzzle-prototype-carrier-v1|${entry.puzzleBlueprintId}|${entry.generatorVersion}`);
  const offset = 3 + bytes[0]! % 17;
  const reverse = Boolean(bytes[1]! % 2);
  const values = Array.from(answer, (character) => character.codePointAt(0)! + offset);
  const orderedValues = reverse ? values.reverse() : values;
  const label = clueLabels[entry.prototypeKind];
  return {
    instanceId: hmac(secret, `witness-puzzle-prototype-instance-v1|${entry.puzzleBlueprintId}`).toString("hex").slice(0, 20),
    instructions: `Read the ${label} values ${reverse ? "from last to first" : "from first to last"}, subtract ${offset} from each value, and convert each result to its Unicode character.`,
    clues: orderedValues.map((value, index) => `${label} ${String(index + 1).padStart(2, "0")} · ${value}`),
  };
}

function normalizeSubmission(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("en-US");
}

function equalsExpected(submission: string, expected: string, secret: string) {
  const left = createHmac("sha256", secret).update(`prototype-submission-v1|${normalizeSubmission(submission)}`).digest();
  const right = createHmac("sha256", secret).update(`prototype-submission-v1|${normalizeSubmission(expected)}`).digest();
  return timingSafeEqual(left, right);
}

export function getPuzzlePrototypeCatalog(secret = getAuthEnv().BETTER_AUTH_SECRET) {
  return {
    prototypes: getPublicPuzzlePrototypeCatalog(catalog).map((entry) => ({
      ...entry,
      challenge: createPuzzlePrototypeChallenge(entry, secret),
    })),
    total: catalog.length,
    timerStarted: false as const,
  };
}

export function validatePuzzlePrototype(
  input: z.infer<typeof puzzlePrototypeSubmissionSchema>,
  secret = getAuthEnv().BETTER_AUTH_SECRET,
) {
  const prototype = catalog.find((entry) => entry.puzzleBlueprintId === input.puzzleBlueprintId);
  if (!prototype) throw new Error(`Unknown Puzzle prototype: ${input.puzzleBlueprintId}`);
  return {
    correct: equalsExpected(input.answer, derivePuzzlePrototypeAnswer(prototype, secret), secret),
    puzzleBlueprintId: input.puzzleBlueprintId,
    timerStarted: false as const,
  };
}

