import lookupData from "../data/lookup-presentation.json";
import { breedGroupLabel } from "./worldbuilding";
import { ownerContextLabel } from "./owner-presentation";

type LookupRule = {
  primary?: string;
  primaryTemplate?: string;
  technicalId?: string;
  context?: Array<string | { label: string; path: string }>;
};

export type LookupPresentation = {
  primary: string;
  technicalId: string | null;
  context: string[];
};

export class LookupPresentationError extends Error {
  override name = "LookupPresentationError";
}

const baseRules = lookupData.lookupPresentation as Record<string, LookupRule>;
const ownerFormRules = lookupData.ownerFormLookupPresentation as Record<string, LookupRule>;
const rules = { ...ownerFormRules, ...baseRules };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pathValue(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => isRecord(value) ? value[segment] : undefined, record);
}

function displayValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return null;
}

function requiredPath(record: Record<string, unknown>, entity: string, path: string): string {
  const value = displayValue(pathValue(record, path));
  if (!value) throw new LookupPresentationError(`${entity} lookup requires ${path}.`);
  return value;
}

function templateValue(record: Record<string, unknown>, entity: string, template: string): string {
  return template.replace(/\{([^}]+)\}/g, (_match, path: string) => requiredPath(record, entity, path));
}

function presentationForRules(
  availableRules: Record<string, LookupRule>,
  entity: string,
  record: Record<string, unknown> | null | undefined,
): LookupPresentation | null {
  if (record == null) return null;
  const rule = availableRules[entity];
  if (!rule) throw new LookupPresentationError(`No owner-authored lookup presentation exists for ${entity}.`);
  const primary = rule.primary
    ? requiredPath(record, entity, rule.primary)
    : rule.primaryTemplate
      ? templateValue(record, entity, rule.primaryTemplate)
      : null;
  if (!primary) throw new LookupPresentationError(`${entity} lookup has no primary presentation rule.`);

  const technicalId = rule.technicalId ? requiredPath(record, entity, rule.technicalId) : null;

  return {
    primary,
    technicalId,
    context: (rule.context ?? []).flatMap((contextRule) => {
      const path = typeof contextRule === "string" ? contextRule : contextRule.path;
      const rawValue = pathValue(record, path);
      const value = displayValue(entity === "Breed" && path === "groupId" && typeof rawValue === "string" ? breedGroupLabel(rawValue) : rawValue);
      const ownerValue = value ? ownerContextLabel(path, value) : null;
      return ownerValue ? [typeof contextRule === "string" ? ownerValue : `${contextRule.label}: ${ownerValue}`] : [];
    }),
  };
}

export function lookupPresentationFor(
  entity: string,
  record: Record<string, unknown> | null | undefined,
): LookupPresentation | null {
  return presentationForRules(rules, entity, record);
}

export function ownerFormLookupPresentationFor(
  entity: string,
  record: Record<string, unknown> | null | undefined,
): LookupPresentation | null {
  return presentationForRules({ ...baseRules, ...ownerFormRules }, entity, record);
}

export function lookupSearchText(presentation: LookupPresentation | null): string {
  if (!presentation) return "";
  return [presentation.primary, presentation.technicalId, ...presentation.context]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase();
}

export function lookupPresentationRule(entity: string): LookupRule {
  const rule = rules[entity];
  if (!rule) throw new LookupPresentationError(`No owner-authored lookup presentation exists for ${entity}.`);
  return rule;
}
