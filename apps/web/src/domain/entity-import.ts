import { parse as parseYaml } from "yaml";

import { entityFields, type EntityName } from "../content/entities";

export type ImportRecord = Record<string, unknown>;
export type FieldMapping = Record<string, string | null | undefined>;

export interface PreparedEntityImport {
  errors: string[];
  rows: ImportRecord[];
  sourceFields: string[];
}

function normalizeRecordArray(value: unknown): ImportRecord[] {
  if (!Array.isArray(value)) throw new Error("Import data must be an array of records.");
  return value.map((row, index) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new Error(`Import row ${index + 1} must be an object.`);
    }
    return { ...row } as ImportRecord;
  });
}

function parseCsvRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const finishField = () => {
    row.push(field);
    field = "";
  };
  const finishRow = () => {
    finishField();
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"' && field === "") {
      quoted = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\n") {
      finishRow();
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field !== "" || row.length > 0) finishRow();
  return rows;
}

function parseCsv(source: string): ImportRecord[] {
  const [rawHeaders, ...rows] = parseCsvRows(source);
  if (!rawHeaders) throw new Error("CSV requires a header row.");
  const headers = rawHeaders.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, "").trim() : header.trim(),
  );
  if (headers.some((header) => !header)) throw new Error("CSV headers cannot be empty.");
  const duplicate = headers.find((header, index) => headers.indexOf(header) !== index);
  if (duplicate) throw new Error(`Duplicate CSV header: ${duplicate}`);

  return rows.map((values, index) => {
    if (values.length > headers.length) {
      throw new Error(`CSV row ${index + 2} has more values than headers.`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
  });
}

export function parseEntityImport(source: string, fileName: string): ImportRecord[] {
  const extension = fileName.toLowerCase().split(".").at(-1);
  if (extension === "json") return normalizeRecordArray(JSON.parse(source) as unknown);
  if (extension === "yaml" || extension === "yml") {
    return normalizeRecordArray(parseYaml(source) as unknown);
  }
  if (extension === "csv") return parseCsv(source);
  throw new Error("Unsupported import format. Use JSON, YAML, or CSV.");
}

function collectSourceFields(rows: ImportRecord[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
}

export function createDefaultFieldMapping(
  entity: EntityName,
  rows: ImportRecord[],
): FieldMapping {
  const targets = new Set<string>(entityFields[entity]);
  return Object.fromEntries(
    collectSourceFields(rows).map((field) => [field, targets.has(field) ? field : undefined]),
  );
}

export function prepareEntityImport(
  entity: EntityName,
  sourceRows: ImportRecord[],
  mapping: FieldMapping,
): PreparedEntityImport {
  const sourceFields = collectSourceFields(sourceRows);
  const targetFields = new Set<string>(entityFields[entity]);
  const errors: string[] = [];
  const usedTargets = new Set<string>();

  if (sourceRows.length === 0) errors.push("Import requires at least one row.");
  for (const sourceField of sourceFields) {
    const target = mapping[sourceField];
    if (target === undefined) {
      errors.push(`Source field ${sourceField} must be mapped or ignored.`);
      continue;
    }
    if (target === null) continue;
    if (!targetFields.has(target)) {
      errors.push(`Target field ${target} is not valid for ${entity}.`);
      continue;
    }
    if (usedTargets.has(target)) errors.push(`Target field ${target} is mapped more than once.`);
    usedTargets.add(target);
  }

  const rows = sourceRows.map((sourceRow) => {
    const targetRow: ImportRecord = {};
    for (const sourceField of sourceFields) {
      const target = mapping[sourceField];
      if (typeof target === "string" && targetFields.has(target)) {
        targetRow[target] = sourceRow[sourceField];
      }
    }
    return targetRow;
  });

  const idField = entityFields[entity][0];
  const identifiers = new Set<string>();
  rows.forEach((row, index) => {
    const identifier = row[idField];
    if (typeof identifier !== "string" || identifier.trim() === "") {
      errors.push(`Row ${index + 1} requires ${idField}.`);
      return;
    }
    if (identifiers.has(identifier)) {
      errors.push(`Row ${index + 1} duplicates ${idField} ${identifier}.`);
    }
    identifiers.add(identifier);
  });

  return { errors: [...new Set(errors)], rows, sourceFields };
}
