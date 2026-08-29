import { breedGroupLabel } from "./worldbuilding";

const exactTokenLabels: Record<string, string> = {
  AI: "AI",
  NON_BINARY: "Non-binary",
  SPECTRAL_VIOLET: "Spectral violet",
};

export function humanizeOwnerToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (exactTokenLabels[trimmed]) return exactTokenLabels[trimmed]!;
  const words = trimmed.toLocaleLowerCase().replaceAll("_", " ");
  return words.replace(/^./, (first) => first.toLocaleUpperCase());
}

export function canonicalizeOwnerToken(value: string): string {
  return value.trim().toLocaleUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function ownerEnumLabel(type: string, value: string): string {
  if (type === "BreedGroupId") return breedGroupLabel(value);
  return humanizeOwnerToken(value);
}

export function ownerNullLabel(fieldName: string): string {
  const normalized = fieldName.toLocaleLowerCase().replace(/[^a-z]/g, "");
  if (normalized.includes("legendaryreward")) return "No reward";
  if (normalized.includes("constellation")) return "No constellation";
  return "Not assigned";
}

export function ownerContextLabel(path: string, value: string): string {
  const fieldName = path.split(".").at(-1) ?? path;
  if (fieldName === "groupId") return ownerEnumLabel("BreedGroupId", value);
  if (["worldKey", "department", "faction", "gender", "primaryAttribute", "secondaryAttribute"].includes(fieldName)) return humanizeOwnerToken(value);
  return value;
}
