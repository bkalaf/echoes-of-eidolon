export const PROTOTYPE_FAMILY_KINDS = Object.freeze({
  TEXT_LANGUAGE_LITERARY: "TEXT_COMPARE",
  CRYPTO_NUMERIC_DATA: "DATA_TRANSFORM",
  VISUAL_COLOR_OPTICAL: "VISUAL_LAYER",
  SPATIAL_FOLDING_GEOMETRY: "SPATIAL_BOARD",
  AUDIO_MUSIC_SPECTRAL: "AUDIO_SEQUENCE",
  LOGIC_CONSTRAINT: "CONSTRAINT_GRID",
  HISTORICAL_RESEARCH: "SOURCE_CHAIN",
  CONSTRUCTION_SIMULATION: "MECHANISM_BOARD",
  CROSS_MODAL: "CROSS_MODAL",
} as const);

export type PuzzlePrototypeKind = typeof PROTOTYPE_FAMILY_KINDS[keyof typeof PROTOTYPE_FAMILY_KINDS];

export interface PuzzlePrototypeHint {
  level: number;
  kind: string;
  text: string;
}

export interface PuzzlePrototypeCatalogEntry {
  puzzleBlueprintId: string;
  title: string;
  concept: string;
  primaryFamily: keyof typeof PROTOTYPE_FAMILY_KINDS;
  secondaryFamilies: string[];
  difficultyTier: string;
  generatorVersion: string;
  answerFormat: string;
  answerDerivation: string;
  estimatedSolveTime: string;
  playerFacingModalities: string[];
  accessibilityModalities: string[];
  prototypeKind: PuzzlePrototypeKind;
  controls: string[];
  cues: string[];
  decoys: string[];
  hints: PuzzlePrototypeHint[];
  expectedSolvePath: string[];
  sources: unknown[];
}

export type PublicPuzzlePrototype = PuzzlePrototypeCatalogEntry;

const difficultyTiers = [
  "TIER_1_INITIATE",
  "TIER_2_ADEPT",
  "TIER_3_EXPERT",
  "TIER_4_MASTER",
  "TIER_5_ORDEAL",
] as const;

const familyCounts: Readonly<Record<keyof typeof PROTOTYPE_FAMILY_KINDS, number>> = Object.freeze({
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Puzzle prototype ${key} must be nonempty text.`);
  return value;
}

function stringArray(record: Record<string, unknown>, key: string, minimum = 0): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string") || value.length < minimum) {
    throw new Error(`Puzzle prototype ${key} must contain at least ${minimum} text value(s).`);
  }
  return [...value] as string[];
}

function parseHint(value: unknown): PuzzlePrototypeHint {
  if (!isRecord(value)) throw new Error("Puzzle prototype hints must be objects.");
  const level = value.level;
  if (!Number.isInteger(level) || (level !== 1 && level !== 2)) throw new Error("Puzzle prototype hint levels must be 1 or 2.");
  return { level: level as number, kind: requiredString(value, "kind"), text: requiredString(value, "text") };
}

function parseEntry(value: unknown): PuzzlePrototypeCatalogEntry {
  if (!isRecord(value)) throw new Error("Puzzle prototype catalog entries must be objects.");
  const primaryFamily = requiredString(value, "primaryFamily") as keyof typeof PROTOTYPE_FAMILY_KINDS;
  if (!(primaryFamily in PROTOTYPE_FAMILY_KINDS)) throw new Error(`Unknown Puzzle prototype family: ${primaryFamily}`);
  const prototypeKind = requiredString(value, "prototypeKind") as PuzzlePrototypeKind;
  if (prototypeKind !== PROTOTYPE_FAMILY_KINDS[primaryFamily]) throw new Error(`Puzzle prototype renderer does not match ${primaryFamily}.`);
  const hints = Array.isArray(value.hints) ? value.hints.map(parseHint) : [];
  if (hints.length !== 2 || hints[0]?.level !== 1 || hints[1]?.level !== 2) throw new Error("Puzzle prototypes require two ordered authored hints.");
  return {
    puzzleBlueprintId: requiredString(value, "puzzleBlueprintId"),
    title: requiredString(value, "title"),
    concept: requiredString(value, "concept"),
    primaryFamily,
    secondaryFamilies: stringArray(value, "secondaryFamilies"),
    difficultyTier: requiredString(value, "difficultyTier"),
    generatorVersion: requiredString(value, "generatorVersion"),
    answerFormat: requiredString(value, "answerFormat"),
    answerDerivation: requiredString(value, "answerDerivation"),
    estimatedSolveTime: requiredString(value, "estimatedSolveTime"),
    playerFacingModalities: stringArray(value, "playerFacingModalities", 1),
    accessibilityModalities: stringArray(value, "accessibilityModalities", 1),
    prototypeKind,
    controls: stringArray(value, "controls", 1),
    cues: stringArray(value, "cues", 1),
    decoys: stringArray(value, "decoys", 1),
    hints,
    expectedSolvePath: stringArray(value, "expectedSolvePath", 1),
    sources: Array.isArray(value.sources) ? [...value.sources] : [],
  };
}

export function loadPuzzlePrototypeCatalog(value: unknown): readonly PuzzlePrototypeCatalogEntry[] {
  if (!Array.isArray(value)) throw new Error("Puzzle prototype catalog must be an array.");
  const catalog = value.map(parseEntry);
  if (catalog.length !== 70) throw new Error("Puzzle prototype catalog must contain exactly 70 approved blueprints.");
  const ids = catalog.map((entry) => entry.puzzleBlueprintId);
  if (new Set(ids).size !== ids.length) throw new Error("Puzzle prototype identities must be unique.");
  for (let index = 0; index < 70; index += 1) {
    const expected = `PZB-${String(index + 1).padStart(3, "0")}`;
    if (ids[index] !== expected) throw new Error(`Puzzle prototype catalog must be ordered and include ${expected}.`);
  }
  for (const tier of difficultyTiers) {
    if (catalog.filter((entry) => entry.difficultyTier === tier).length !== 14) throw new Error(`Puzzle prototype tier ${tier} must contain exactly 14 entries.`);
  }
  for (const [family, count] of Object.entries(familyCounts)) {
    if (catalog.filter((entry) => entry.primaryFamily === family).length !== count) throw new Error(`Puzzle prototype family ${family} must contain exactly ${count} entries.`);
  }
  return Object.freeze(catalog.map((entry) => Object.freeze(entry)));
}

export function getPublicPuzzlePrototypeCatalog(
  catalog: readonly PuzzlePrototypeCatalogEntry[],
): readonly PublicPuzzlePrototype[] {
  return catalog.map((entry) => ({ ...entry }));
}
