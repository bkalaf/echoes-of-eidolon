import { staticPresentationQa } from "./presentation-audit";

export interface EntityFormField {
  enumValues: string[];
  hasDefault: boolean;
  isList: boolean;
  isRequired: boolean;
  kind: "enum" | "json" | "scalar";
  name: string;
  type: string;
}

export type AdminFieldControl =
  | "IDENTITY"
  | "REFERENCE"
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "INTEGER"
  | "DECIMAL"
  | "BOOLEAN"
  | "DATETIME"
  | "ENUM"
  | "ENUM_LIST"
  | "STRING_LIST"
  | "JSON"
  | "CLOTHING"
  | "UNSUPPORTED";

const longTextFields = new Set([
  "accent", "anthropomorphization", "appearance", "architecture", "baseContent", "definition",
  "clothing", "description", "expression", "notes", "reason", "rendering", "summary",
]);

export function adminFieldControl(entity: string, idField: string, field: EntityFormField): AdminFieldControl {
  if (field.name === "clothing" && ["Species", "Culture", "Breed"].includes(entity)) return "CLOTHING";
  if (field.name === idField) return "IDENTITY";
  if (field.kind === "enum") return field.isList ? "ENUM_LIST" : "ENUM";
  if (field.kind === "json") return "JSON";
  if (field.isList && field.type === "String") return "STRING_LIST";
  if (field.type === "Int" || field.type === "BigInt") return "INTEGER";
  if (field.type === "Float" || field.type === "Decimal") return "DECIMAL";
  if (field.type === "Boolean") return "BOOLEAN";
  if (field.type === "DateTime") return "DATETIME";
  if (field.type === "String" && field.name.endsWith("Id")) return "REFERENCE";
  if (field.type === "String" && longTextFields.has(field.name)) return "LONG_TEXT";
  if (field.type === "String") return "SHORT_TEXT";
  return "UNSUPPORTED";
}

function parsedList(value: string): unknown[] | undefined {
  try { const parsed = JSON.parse(value) as unknown; return Array.isArray(parsed) ? parsed : undefined; } catch { return undefined; }
}

export function validateAdminEntityDraft(
  entity: string,
  idField: string,
  fields: readonly EntityFormField[],
  draft: Readonly<Record<string, string>>,
): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    const value = draft[field.name] ?? "";
    const control = adminFieldControl(entity, idField, field);
    if (field.isRequired && !field.hasDefault && !value.trim()) {
      errors.push(`${field.name} is required.`);
      continue;
    }
    if (!value.trim()) continue;
    if (control === "INTEGER" && !/^-?\d+$/.test(value.trim())) errors.push(`${field.name} must be a valid ${field.type}.`);
    if (control === "DECIMAL" && !Number.isFinite(Number(value))) errors.push(`${field.name} must be a valid ${field.type}.`);
    if (control === "ENUM" && !field.enumValues.includes(value)) errors.push(`${field.name} must use a controlled value.`);
    if (control === "ENUM_LIST" || control === "STRING_LIST") {
      const list = parsedList(value);
      if (!list) errors.push(`${field.name} must be a valid list.`);
      else {
        if (field.isRequired && list.length === 0) errors.push(`${field.name} requires at least one value.`);
        if (new Set(list.map(String)).size !== list.length) errors.push(`${field.name} cannot contain duplicate values.`);
        if (control === "ENUM_LIST" && list.some((entry) => typeof entry !== "string" || !field.enumValues.includes(entry))) errors.push(`${field.name} contains an uncontrolled value.`);
      }
    }
    if (control === "JSON") {
      try { JSON.parse(value); } catch { errors.push(`${field.name} must contain valid JSON.`); }
    }
    if (entity === "WitnessDef" && field.name === "color") {
      try {
        const color = JSON.parse(value) as Record<string, unknown>;
        const channels = ["SPECTRAL_VIOLET", "GREEN", "WHITE"];
        const exactKeys = Object.keys(color).sort().join(",") === [...channels].sort().join(",");
        const percentages = channels.map((channel) => color[channel]);
        if (!exactKeys || percentages.some((percentage) => typeof percentage !== "number" || !Number.isFinite(percentage) || percentage < 0 || percentage > 100)) errors.push("color requires exactly SPECTRAL_VIOLET, GREEN, and WHITE percentages from 0 through 100.");
        else if (Math.abs((percentages as number[]).reduce((sum, percentage) => sum + percentage, 0) - 100) > 0.0001) errors.push("color percentages must total 100.");
      } catch { /* generic JSON validation already owns parse errors */ }
    }
    if (control === "CLOTHING") errors.push(...staticPresentationQa("clothing", value).failures);
  }
  return [...new Set(errors)];
}
