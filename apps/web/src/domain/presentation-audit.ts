import { resolvePresentation } from "./worldbuilding";

export const presentationAuditDispositions = ["PASS", "NOT_APPLICABLE", "BLOCKED_BY_RESEARCH_STATUS", "FAIL"] as const;
export type PresentationAuditDisposition = typeof presentationAuditDispositions[number];
export type PresentationField = "accent" | "appearance" | "clothing" | "architecture";
export type PresentationResearchStatus = "RESOLVED" | "REVIEW_REQUIRED" | "CONFLICTING_SOURCES" | "NOT_FOUND" | "ID_COLLISION_REVIEW_REQUIRED";

export const clothingSections = ["Civilian", "Light armor", "Medium armor", "Heavy armor", "Weapons"] as const;
export type ClothingSection = typeof clothingSections[number];

export interface SemanticPresentationChecks {
  correctFieldMeaning: boolean;
  culturalSpecificity: boolean;
  antiEssentialism: boolean;
  respectfulCraftsmanship: boolean;
  nonEuropeanization: boolean;
  directVoiceCasting: boolean;
  usableRenderDetail: boolean;
  legendaryHistoricitySeparated: boolean;
}

export interface SemanticPresentationReview {
  reviewedValue: string;
  reviewer: string;
  checks: SemanticPresentationChecks;
}

export interface PresentationAuditResult {
  entityId: string;
  field: PresentationField;
  scope: "AUTHORED" | "EFFECTIVE_BREED";
  disposition: PresentationAuditDisposition;
  staticQa: { passed: boolean; failures: string[] };
  semanticReview: { passed: boolean; reviewer: string | null; failures: string[] };
}

const bannedMetaPatterns: Array<[RegExp, string]> = [
  [/\bEIDOLON_NORMALIZED\b/i, "EIDOLON_NORMALIZED label"],
  [/\b(?:source|citation|evidence|research)\s*[-:]/i, "source or research commentary"],
  [/\b(?:may use|can draw from)\b/i, "optional source language"],
  [/\b(?:not historically attested|historicity caveat|disclaimer|inference)\b/i, "research caveat"],
];
const prohibitedRespectPatterns: Array<[RegExp, string]> = [
  [/\b(?:savage|primitive|backwards|crude|uncivilized)\b/i, "prohibited cultural framing"],
];

export function parseClothingSections(value: string): Partial<Record<ClothingSection, string>> {
  const result: Partial<Record<ClothingSection, string>> = {};
  const heading = /^(Civilian|Light armor|Medium armor|Heavy armor|Weapons):\s*(.*)$/;
  let current: ClothingSection | undefined;
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = heading.exec(line);
    if (match) {
      current = match[1] as ClothingSection;
      result[current] = match[2]?.trim() ?? "";
    } else if (current && line) {
      result[current] = `${result[current] ? `${result[current]} ` : ""}${line}`;
    }
  }
  return result;
}

export function formatClothingSections(sections: Partial<Record<ClothingSection, string>>): string {
  return clothingSections.map((section) => `${section}: ${sections[section]?.trim() ?? ""}`).join("\n");
}

export function staticPresentationQa(field: PresentationField, value: string): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  if (!value.trim()) failures.push(`${field} cannot be blank.`);
  if (/https?:\/\/|www\./i.test(value)) failures.push(`${field} contains a URL.`);
  if (/\[[^\]]+\]\([^)]+\)|\(\s*(?:ibid\.?|op\.\s*cit\.)/i.test(value)) failures.push(`${field} contains citation markup.`);
  for (const [pattern, label] of bannedMetaPatterns) if (pattern.test(value)) failures.push(`${field} contains banned meta language: ${label}.`);
  for (const [pattern, label] of prohibitedRespectPatterns) if (pattern.test(value)) failures.push(`${field} contains ${label}.`);
  if (field === "clothing") {
    const sections = parseClothingSections(value);
    for (const section of clothingSections) if (!sections[section]?.trim()) failures.push(`clothing requires section ${section} with renderable design.`);
    const encountered = value.split(/\r?\n/).map((line) => /^(Civilian|Light armor|Medium armor|Heavy armor|Weapons):/.exec(line.trim())?.[1]).filter(Boolean);
    if (encountered.length === clothingSections.length && encountered.some((section, index) => section !== clothingSections[index])) failures.push("clothing sections must use canonical order.");
  }
  return { passed: failures.length === 0, failures: [...new Set(failures)] };
}

function semanticResult(value: string, review?: SemanticPresentationReview) {
  const failures: string[] = [];
  if (!review) failures.push("Independent semantic review is required.");
  else {
    if (!review.reviewer.trim()) failures.push("Semantic reviewer identity is required.");
    if (review.reviewedValue !== value) failures.push("Semantic review does not cover the exact audited value.");
    for (const [check, passed] of Object.entries(review.checks)) if (!passed) failures.push(`Semantic check ${check} failed.`);
  }
  return { passed: failures.length === 0, reviewer: review?.reviewer ?? null, failures };
}

export function auditPresentationField(input: {
  entityId: string;
  field: PresentationField;
  researchStatus: PresentationResearchStatus;
  value: string | null | undefined;
  applicable?: boolean;
  scope?: "AUTHORED" | "EFFECTIVE_BREED";
  semanticReview?: SemanticPresentationReview;
}): PresentationAuditResult {
  const applicable = input.applicable ?? true;
  const staticQa = input.value == null ? { passed: false, failures: [`${input.field} is absent.`] } : staticPresentationQa(input.field, input.value);
  const semanticReview = input.value == null ? { passed: false, reviewer: null, failures: ["No value exists for semantic review."] } : semanticResult(input.value, input.semanticReview);
  let disposition: PresentationAuditDisposition;
  if (!applicable && input.value == null) disposition = "NOT_APPLICABLE";
  else if (input.researchStatus !== "RESOLVED") disposition = "BLOCKED_BY_RESEARCH_STATUS";
  else disposition = staticQa.passed && semanticReview.passed ? "PASS" : "FAIL";
  return { entityId: input.entityId, field: input.field, scope: input.scope ?? "AUTHORED", disposition, staticQa, semanticReview };
}

type PresentationValues = { accent?: string | null; appearance?: string | null; clothing?: string | null; architecture?: string | null };

export function auditEffectiveBreedPresentation(input: {
  breedId: string;
  researchStatus: PresentationResearchStatus;
  species: PresentationValues;
  culture?: PresentationValues | null;
  breed?: PresentationValues | null;
  pet?: boolean;
  semanticReviews?: Partial<Record<PresentationField, SemanticPresentationReview>>;
}): PresentationAuditResult[] {
  const effective = resolvePresentation(input.species, input.culture, input.breed);
  return (["accent", "appearance", "clothing", "architecture"] as const).map((field) => auditPresentationField({
    applicable: !(input.pet && field !== "appearance"),
    entityId: input.breedId,
    field,
    researchStatus: input.researchStatus,
    scope: "EFFECTIVE_BREED",
    semanticReview: input.semanticReviews?.[field],
    value: effective[field],
  }));
}

export function presentationAuditJsonl(audits: readonly PresentationAuditResult[]): string {
  return audits.map((audit) => JSON.stringify(audit)).join("\n");
}

export function assertPresentationPackagingGate(input: {
  audits: readonly PresentationAuditResult[];
  expected: ReadonlyArray<{ entityId: string; field: PresentationField; scope: "AUTHORED" | "EFFECTIVE_BREED"; researchStatus: PresentationResearchStatus; applicable: boolean }>;
}): void {
  const failures: string[] = [];
  for (const expected of input.expected) {
    const matches = input.audits.filter((audit) => audit.entityId === expected.entityId && audit.field === expected.field && audit.scope === expected.scope);
    if (matches.length !== 1) {
      failures.push(`${expected.scope}:${expected.entityId}:${expected.field} requires exactly one presentation audit.`);
      continue;
    }
    const required = !expected.applicable
      ? "NOT_APPLICABLE"
      : expected.researchStatus === "RESOLVED"
        ? "PASS"
        : "BLOCKED_BY_RESEARCH_STATUS";
    if (matches[0]!.disposition !== required) failures.push(`${expected.scope}:${expected.entityId}:${expected.field} requires ${required}, received ${matches[0]!.disposition}.`);
  }
  for (const audit of input.audits) if (audit.disposition === "FAIL") failures.push(`${audit.scope}:${audit.entityId}:${audit.field} has FAIL disposition.`);
  if (failures.length) throw new Error(`PRESENTATION_AUDIT_COMPLETION_BLOCKER: ${[...new Set(failures)].join(" ")}`);
}
