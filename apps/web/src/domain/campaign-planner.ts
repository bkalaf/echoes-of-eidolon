import { DepartmentWitnessPathStatus } from "../generated/prisma/enums";

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

function normalizeBooks(books: readonly number[]) {
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
  const normalized = normalizeBooks(books);
  const startBook = normalized[0]!;
  const endBook = normalized.at(-1)!;
  const rowSpan = endBook - startBook + 1;
  if (rowSpan !== normalized.length) throw new CampaignBookRangeError("Campaign Books must form one contiguous range.");
  return { endBook, rowSpan, startBook };
}

export function duologyCounterpart(bookNumber: number): number {
  if (!Number.isInteger(bookNumber) || bookNumber < 1 || bookNumber > 18) throw new CampaignBookRangeError("A duology Book must be an integer from 1 through 18.");
  return 19 - bookNumber;
}

export function isCanonicalDuologyPair(books: readonly number[]): boolean {
  const normalized = normalizeBooks(books);
  return normalized.length === 2 && normalized[1] === duologyCounterpart(normalized[0]!);
}

export function campaignPlacementBookRange(objectType: CampaignObjectType, books: readonly number[]): CampaignBookRange {
  if (!isValidCampaignSpan(objectType, books)) throw new CampaignBookRangeError("The selected Books do not form a valid span for this campaign object type.");
  const normalized = normalizeBooks(books);
  if (objectType === "TRANSITION" || objectType === "DEJA_VU" || objectType === "COMPANION") {
    const startBook = normalized[0]!;
    const endBook = normalized[1]!;
    return { endBook, rowSpan: endBook - startBook + 1, startBook };
  }
  return campaignBookRange(normalized);
}

export function isValidCampaignSpan(objectType: CampaignObjectType, books: readonly number[]): boolean {
  const normalized = normalizeBooks(books);
  if (objectType === "PILLAR") return pillarSpans.some((span) => sameBooks(normalized, span));
  if (objectType === "LESSON" || objectType === "IN_TRANSIT") return sixBookSpans.some((span) => sameBooks(normalized, span));
  if (objectType === "EXODUS") return threeBookSpans.some((span) => sameBooks(normalized, span));
  if (objectType === "TRANSITION" || objectType === "DEJA_VU" || objectType === "COMPANION") return isCanonicalDuologyPair(normalized);
  if (objectType === "HOLIDAY") return normalized.length === 1 && holidayBooks.has(normalized[0]!);
  return singleBookTypes.has(objectType) && normalized.length === 1;
}

export function linkedCampaignGroup(objectType: CampaignObjectType): CampaignLinkedGroupRule | null {
  return campaignLinkedGroups.find((group) =>
    [...group.required, ...group.optional].some((member) => member.objectType === objectType),
  ) ?? null;
}

export function departmentCampaignDisposition(departmentId: string): DepartmentWitnessPathStatus {
  const match = /^DEPT-(\d{3})$/.exec(departmentId);
  const ordinal = match ? Number(match[1]) : 0;
  if (ordinal < 1 || ordinal > 54) throw new Error("Department must be one of the controlled DEPT-001 through DEPT-054 rows.");
  if (ordinal === 53) return DepartmentWitnessPathStatus.EXEMPT;
  if (ordinal === 54) return DepartmentWitnessPathStatus.EXCLUDED;
  return DepartmentWitnessPathStatus.NORMAL;
}
