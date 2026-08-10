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

export const campaignLinkedGroups = [
  ["WITNESS", "ARCHITECT", "LEGENDARY_REWARD", "ATROCITY", "WWII_INTERLUDE", "MYTH_INTERLUDE", "SCIENCE_INTERLUDE", "HISTORICAL_INTERLUDE"],
  ["COMPANION", "TRANSITION", "DEJA_VU"],
  ["LESSON", "IN_TRANSIT", "EXODUS"],
] as const satisfies readonly (readonly CampaignObjectType[])[];

const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, index) => start + index);
const pillarSpans = [range(1, 9), range(10, 18)];
const sixBookSpans = [range(1, 6), range(7, 12), range(13, 18)];
const threeBookSpans = [range(1, 3), range(4, 6), range(7, 9), range(10, 12), range(13, 15), range(16, 18)];
const pairedSpans = [[1, 18], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 17]];
const singleBookTypes = new Set<CampaignObjectType>([
  "ATROCITY", "WITNESS", "ARCHITECT", "LEGENDARY_REWARD",
  "WWII_INTERLUDE", "MYTH_INTERLUDE", "SCIENCE_INTERLUDE", "HISTORICAL_INTERLUDE",
]);
const holidayBooks = new Set([1, 5, 10, 14]);

function sameBooks(actual: readonly number[], expected: readonly number[]) {
  return actual.length === expected.length && actual.every((book, index) => book === expected[index]);
}

function normalizeBooks(books: readonly number[]) {
  if (books.length === 0) throw new Error("A campaign placement must include at least one Book.");
  if (books.some((book) => !Number.isInteger(book) || book < 1 || book > 18)) throw new Error("Campaign Books must be integers from 1 through 18.");
  const normalized = [...new Set(books)].sort((a, b) => a - b);
  if (normalized.length !== books.length) throw new Error("A campaign placement cannot repeat a Book.");
  return normalized;
}

export function isValidCampaignSpan(objectType: CampaignObjectType, books: readonly number[]): boolean {
  const normalized = normalizeBooks(books);
  if (objectType === "PILLAR") return pillarSpans.some((span) => sameBooks(normalized, span));
  if (objectType === "LESSON" || objectType === "IN_TRANSIT") return sixBookSpans.some((span) => sameBooks(normalized, span));
  if (objectType === "EXODUS") return threeBookSpans.some((span) => sameBooks(normalized, span));
  if (objectType === "TRANSITION" || objectType === "DEJA_VU" || objectType === "COMPANION") return pairedSpans.some((span) => sameBooks(normalized, span));
  if (objectType === "HOLIDAY") return normalized.length === 1 && holidayBooks.has(normalized[0]!);
  return singleBookTypes.has(objectType) && normalized.length === 1;
}

export function linkedCampaignGroup(objectType: CampaignObjectType): readonly CampaignObjectType[] | null {
  return campaignLinkedGroups.find((group) => group.includes(objectType as never)) ?? null;
}

export function departmentCampaignDisposition(departmentId: string): "NORMAL_WITNESS_PATH" | "EXEMPT" | "EXCLUDED" {
  const match = /^DEPT-(\d{3})$/.exec(departmentId);
  const ordinal = match ? Number(match[1]) : 0;
  if (ordinal < 1 || ordinal > 54) throw new Error("Department must be one of the controlled DEPT-001 through DEPT-054 rows.");
  if (ordinal === 53) return "EXEMPT";
  if (ordinal === 54) return "EXCLUDED";
  return "NORMAL_WITNESS_PATH";
}
