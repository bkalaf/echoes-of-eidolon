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

function tableRecords(rawHeaders: string[], rows: string[][], format: string): ImportRecord[] {
  const headers = rawHeaders.map((header, index) => index === 0 ? header.replace(/^\uFEFF/, "").trim() : header.trim());
  if (headers.some((header) => !header)) throw new Error(`${format} headers cannot be empty.`);
  const duplicate = headers.find((header, index) => headers.indexOf(header) !== index);
  if (duplicate) throw new Error(`Duplicate ${format} header: ${duplicate}`);

  return rows.map((values, index) => {
    if (values.length > headers.length) {
      throw new Error(`${format} row ${index + 2} has more values than headers.`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
  });
}

function splitMarkdownRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "";
  let escaped = false;
  for (const character of trimmed) {
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  if (escaped) cell += "\\";
  cells.push(cell.trim());
  return cells;
}

function parseMarkdownTable(source: string): ImportRecord[] {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) throw new Error("Markdown import requires a header, separator, and at least one data row.");
  const headers = splitMarkdownRow(lines[0]!);
  const separators = splitMarkdownRow(lines[1]!);
  if (separators.length !== headers.length || separators.some((cell) => !/^:?-{3,}:?$/.test(cell))) {
    throw new Error("Markdown table separator does not match the header.");
  }
  return tableRecords(headers, lines.slice(2).map(splitMarkdownRow), "Markdown");
}

function directTableCells(row: Element): string[] {
  return Array.from(row.children)
    .filter((child) => child.tagName === "TH" || child.tagName === "TD")
    .map((cell) => cell.textContent?.trim() ?? "");
}

function parseHtmlTable(source: string): ImportRecord[] {
  const document = new DOMParser().parseFromString(source, "text/html");
  const tables = document.querySelectorAll("table");
  if (tables.length !== 1) throw new Error("HTML import requires exactly one table.");
  const table = tables[0]!;
  if (table.querySelector("[rowspan]:not([rowspan='1']), [colspan]:not([colspan='1'])")) {
    throw new Error("HTML import does not support merged table cells.");
  }
  const rows = Array.from(table.querySelectorAll("tr"));
  const headerRow = rows[0];
  if (!headerRow) throw new Error("HTML table requires a header row.");
  const headers = directTableCells(headerRow);
  if (headers.length === 0) throw new Error("HTML table requires header cells.");
  return tableRecords(headers, rows.slice(1).map(directTableCells), "HTML");
}

export function parseEntityImport(source: string, fileName: string): ImportRecord[] {
  const extension = fileName.toLowerCase().split(".").at(-1);
  if (extension === "json") return normalizeRecordArray(JSON.parse(source) as unknown);
  if (extension === "yaml" || extension === "yml") {
    return normalizeRecordArray(parseYaml(source) as unknown);
  }
  if (extension === "md" || extension === "markdown") return parseMarkdownTable(source);
  if (extension === "html" || extension === "htm") return parseHtmlTable(source);
  throw new Error("Unsupported import format. Use JSON, YAML, Markdown, or HTML tables.");
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
