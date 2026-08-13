import { type EntityType, type WorldKey } from "../generated/prisma/enums";

export const campaignObjectTypes = [
  "PILLAR",
  "LESSON",
  "IN_TRANSIT",
  "EXODUS",
  "TRANSITION",
  "DEJA_VU",
  "COMPANION",
  "ATROCITY",
  "WITNESS",
  "ARCHITECT",
  "LEGENDARY_REWARD",
  "HOLIDAY",
  "WWII_INTERLUDE",
  "MYTH_INTERLUDE",
  "SCIENCE_INTERLUDE",
  "HISTORICAL_INTERLUDE",
] as const;

export type CampaignObjectType = (typeof campaignObjectTypes)[number];

export const campaignPlannerColumns = [
  { id: "PILLAR", label: "Pillar", objectTypes: ["PILLAR"] },
  { id: "LESSON", label: "Lesson", objectTypes: ["LESSON"] },
  { id: "IN_TRANSIT", label: "IN_TRANSIT", objectTypes: ["IN_TRANSIT"] },
  { id: "EXODUS", label: "EXODUS", objectTypes: ["EXODUS"] },
  { id: "TRANSITION", label: "Transition", objectTypes: ["TRANSITION"] },
  { id: "DEJA_VU", label: "DEJA_VU", objectTypes: ["DEJA_VU"] },
  { id: "COMPANION", label: "Companion", objectTypes: ["COMPANION"] },
  { id: "DISJOINT_TRILOGY", label: "Disjoint 3+3", objectTypes: [] },
  { id: "OPPOSING_FACTION", label: "Opposing", objectTypes: [], locked: true },
  { id: "ATROCITY", label: "ATROCITY", objectTypes: ["ATROCITY"] },
  { id: "WITNESS", label: "Witness", objectTypes: ["WITNESS"] },
  { id: "ARCHITECT", label: "Architect", objectTypes: ["ARCHITECT"] },
  { id: "LEGENDARY_REWARD", label: "Reward", objectTypes: ["LEGENDARY_REWARD"] },
  { id: "INTERLUDES", label: "Interludes", objectTypes: ["WWII_INTERLUDE", "MYTH_INTERLUDE", "SCIENCE_INTERLUDE", "HISTORICAL_INTERLUDE", "HOLIDAY"] },
] as const satisfies readonly {
  id: string;
  label: string;
  locked?: boolean;
  objectTypes: readonly CampaignObjectType[];
}[];

export type CampaignPlannerColumnId = (typeof campaignPlannerColumns)[number]["id"];

export class CampaignBookRangeError extends Error {
  override name = "CampaignBookRangeError";
}

export interface CampaignLinkedGroupRule {
  optional: readonly { count: "ZERO_OR_MORE"; objectType: CampaignObjectType }[];
  required: readonly { count: number; objectType: CampaignObjectType }[];
}

const requiredOnce = (...objectTypes: CampaignObjectType[]) =>
  objectTypes.map((objectType) => ({ count: 1, objectType }));

export const campaignLinkedGroups = [
  {
    required: requiredOnce("WITNESS", "ARCHITECT", "LEGENDARY_REWARD", "ATROCITY", "WWII_INTERLUDE", "MYTH_INTERLUDE", "SCIENCE_INTERLUDE"),
    optional: [{ count: "ZERO_OR_MORE", objectType: "HISTORICAL_INTERLUDE" }],
  },
  {
    required: requiredOnce("COMPANION", "TRANSITION", "DEJA_VU"),
    optional: [],
  },
  {
    required: [
      { count: 1, objectType: "LESSON" },
      { count: 1, objectType: "IN_TRANSIT" },
      { count: 2, objectType: "EXODUS" },
    ],
    optional: [],
  },
] as const satisfies readonly CampaignLinkedGroupRule[];

const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, index) => start + index);
const pillarSpans = [range(1, 9), range(10, 18)];
const sixBookSpans = [range(1, 6), range(7, 12), range(13, 18)];
const threeBookSpans = [range(1, 3), range(4, 6), range(7, 9), range(10, 12), range(13, 15), range(16, 18)];
const singleBookTypes = new Set<CampaignObjectType>([
  "ATROCITY", "WITNESS", "ARCHITECT", "LEGENDARY_REWARD",
  "WWII_INTERLUDE", "MYTH_INTERLUDE", "SCIENCE_INTERLUDE", "HISTORICAL_INTERLUDE",
]);
const holidayBooks = new Set([1, 5, 10, 14]);

function sameBooks(actual: readonly number[], expected: readonly number[]) {
  return actual.length === expected.length && actual.every((book, index) => book === expected[index]);
}

export function normalizeCampaignBooks(books: readonly number[]) {
  if (books.length === 0) throw new CampaignBookRangeError("A campaign placement must include at least one Book.");
  if (books.some((book) => !Number.isInteger(book) || book < 1 || book > 18)) throw new CampaignBookRangeError("Campaign Books must be integers from 1 through 18.");
  const normalized = [...new Set(books)].sort((a, b) => a - b);
  if (normalized.length !== books.length) throw new CampaignBookRangeError("A campaign placement cannot repeat a Book.");
  return normalized;
}

export interface CampaignBookRange {
  endBook: number;
  rowSpan: number;
  startBook: number;
}

export function campaignBookRange(books: readonly number[]): CampaignBookRange {
  const normalized = normalizeCampaignBooks(books);
  const startBook = normalized[0]!;
  const endBook = normalized.at(-1)!;
  const rowSpan = endBook - startBook + 1;
  if (rowSpan !== normalized.length) throw new CampaignBookRangeError("Campaign Books must form one contiguous range.");
  return { endBook, rowSpan, startBook };
}

export function campaignBookSegments(books: readonly number[]): CampaignBookRange[] {
  const normalized = normalizeCampaignBooks(books);
  const segments: CampaignBookRange[] = [];
  let startBook = normalized[0]!;
  let previous = startBook;
  for (const book of normalized.slice(1)) {
    if (book !== previous + 1) {
      segments.push({ startBook, endBook: previous, rowSpan: previous - startBook + 1 });
      startBook = book;
    }
    previous = book;
  }
  segments.push({ startBook, endBook: previous, rowSpan: previous - startBook + 1 });
  return segments;
}

export function duologyCounterpart(bookNumber: number): number {
  if (!Number.isInteger(bookNumber) || bookNumber < 1 || bookNumber > 18) throw new CampaignBookRangeError("A duology Book must be an integer from 1 through 18.");
  return 19 - bookNumber;
}

export function isCanonicalDuologyPair(books: readonly number[]): boolean {
  const normalized = normalizeCampaignBooks(books);
  return normalized.length === 2 && normalized[1] === duologyCounterpart(normalized[0]!);
}

export function campaignPlacementBookRange(objectType: CampaignObjectType, books: readonly number[]): CampaignBookRange {
  const segments = campaignPlacementBookSegments(objectType, books);
  if (segments.length !== 1) throw new CampaignBookRangeError("This campaign placement owns multiple visual Book segments.");
  return segments[0]!;
}

export function campaignPlacementBookSegments(objectType: CampaignObjectType, books: readonly number[]): CampaignBookRange[] {
  if (!isValidCampaignSpan(objectType, books)) throw new CampaignBookRangeError("The selected Books do not form a valid span for this campaign object type.");
  const normalized = normalizeCampaignBooks(books);
  if (objectType === "TRANSITION" || objectType === "DEJA_VU" || objectType === "COMPANION") {
    return normalized.map((book) => ({ startBook: book, endBook: book, rowSpan: 1 }));
  }
  return campaignBookSegments(normalized);
}

export function isValidCampaignSpan(objectType: CampaignObjectType, books: readonly number[]): boolean {
  const normalized = normalizeCampaignBooks(books);
  if (objectType === "PILLAR") return pillarSpans.some((span) => sameBooks(normalized, span));
  if (objectType === "LESSON" || objectType === "IN_TRANSIT") return sixBookSpans.some((span) => sameBooks(normalized, span));
  if (objectType === "EXODUS") return threeBookSpans.some((span) => sameBooks(normalized, span));
  if (objectType === "TRANSITION" || objectType === "DEJA_VU" || objectType === "COMPANION") return isCanonicalDuologyPair(normalized);
  if (objectType === "HOLIDAY") return normalized.length === 1 && holidayBooks.has(normalized[0]!);
  return singleBookTypes.has(objectType) && normalized.length === 1;
}

export function campaignBooksForDrop(objectType: CampaignObjectType, targetBook: number): number[] {
  if (!Number.isInteger(targetBook) || targetBook < 1 || targetBook > 18) throw new CampaignBookRangeError("A campaign drop must target Book 1 through 18.");
  if (objectType === "PILLAR") return targetBook <= 9 ? [...pillarSpans[0]!] : [...pillarSpans[1]!];
  if (objectType === "LESSON" || objectType === "IN_TRANSIT") return [...sixBookSpans[Math.floor((targetBook - 1) / 6)]!];
  if (objectType === "EXODUS") return [...threeBookSpans[Math.floor((targetBook - 1) / 3)]!];
  if (objectType === "TRANSITION" || objectType === "DEJA_VU" || objectType === "COMPANION") {
    return [targetBook, duologyCounterpart(targetBook)].sort((left, right) => left - right);
  }
  const books = [targetBook];
  if (!isValidCampaignSpan(objectType, books)) throw new CampaignBookRangeError(`${objectType} cannot be placed at Book ${targetBook}.`);
  return books;
}

export interface BookGroupingValueContract {
  bookGroupingValueId: string;
  worldKey: WorldKey;
  logicalKey: string;
  bookNumbers: readonly number[];
  ordinal: number;
  valueRefType?: EntityType | null;
  valueRefId?: string | null;
}

export interface ProjectedBookGroupingValue extends BookGroupingValueContract {
  groupingType: "DISJOINT_TRILOGY" | "OPPOSING_FACTION";
  editability: "EDITABLE" | "LOCKED";
  segments: CampaignBookRange[];
}

const defaultDisjointBooks = [
  [1, 2, 3, 10, 11, 12],
  [4, 5, 6, 13, 14, 15],
  [7, 8, 9, 16, 17, 18],
] as const;

export function defaultDisjointTrilogy(worldKey: WorldKey): BookGroupingValueContract[] {
  return defaultDisjointBooks.map((bookNumbers, ordinal) => ({
    bookGroupingValueId: `BOOK-GROUPING-DISJOINT-${worldKey}-${String.fromCharCode(65 + ordinal)}`,
    worldKey,
    logicalKey: String.fromCharCode(65 + ordinal),
    bookNumbers: [...bookNumbers],
    ordinal,
  }));
}

export function validateDisjointTrilogy(values: readonly BookGroupingValueContract[], worldKey: WorldKey): ProjectedBookGroupingValue[] {
  if (values.length !== 3) throw new CampaignBookRangeError("Disjoint Trilogy requires exactly three logical values per world.");
  const ids = new Set<string>();
  const keys = new Set<string>();
  const ordinals = new Set<number>();
  const membership: number[] = [];
  const projected = values.map((value) => {
    if (value.worldKey !== worldKey) throw new CampaignBookRangeError("Disjoint Trilogy values must belong to one explicit world.");
    if (!value.bookGroupingValueId.trim() || !value.logicalKey.trim()) throw new CampaignBookRangeError("Book grouping identities must be nonempty.");
    if (ids.has(value.bookGroupingValueId) || keys.has(value.logicalKey) || ordinals.has(value.ordinal)) {
      throw new CampaignBookRangeError("Disjoint Trilogy identities, keys, and ordinals must be unique.");
    }
    ids.add(value.bookGroupingValueId); keys.add(value.logicalKey); ordinals.add(value.ordinal);
    const bookNumbers = normalizeCampaignBooks(value.bookNumbers);
    membership.push(...bookNumbers);
    return {
      ...value,
      bookNumbers,
      groupingType: "DISJOINT_TRILOGY" as const,
      editability: "EDITABLE" as const,
      segments: campaignBookSegments(bookNumbers),
    };
  });
  const sortedMembership = [...membership].sort((left, right) => left - right);
  if (sortedMembership.length !== 18 || sortedMembership.some((book, index) => book !== index + 1)) {
    throw new CampaignBookRangeError("Disjoint Trilogy must cover Books 1 through 18 exactly once.");
  }
  return projected.sort((left, right) => left.ordinal - right.ordinal);
}

const opposingFactionByWorld = {
  CONCORD: "RUIN",
  RUIN: "SCHISM",
  SCHISM: "CONCORD",
} as const satisfies Record<WorldKey, WorldKey>;

export function opposingFactionGrouping(worldKey: WorldKey): ProjectedBookGroupingValue {
  const opposing = opposingFactionByWorld[worldKey];
  const bookNumbers = [...range(1, 6), ...range(13, 18)];
  return {
    bookGroupingValueId: `BOOK-GROUPING-OPPOSING-${worldKey}`,
    worldKey,
    logicalKey: opposing,
    bookNumbers,
    ordinal: 0,
    valueRefType: null,
    valueRefId: null,
    groupingType: "OPPOSING_FACTION",
    editability: "LOCKED",
    segments: campaignBookSegments(bookNumbers),
  };
}

export function plannerColumnForObjectType(objectType: CampaignObjectType): CampaignPlannerColumnId | null {
  return campaignPlannerColumns.find((column) => column.objectTypes.includes(objectType as never))?.id ?? null;
}

export function linkedCampaignGroup(objectType: CampaignObjectType): CampaignLinkedGroupRule | null {
  return campaignLinkedGroups.find((group) =>
    [...group.required, ...group.optional].some((member) => member.objectType === objectType),
  ) ?? null;
}
