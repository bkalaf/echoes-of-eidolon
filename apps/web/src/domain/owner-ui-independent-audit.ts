export interface OwnerFormExpectation {
  name: string;
  nullable?: boolean;
  parentField?: boolean;
  relation?: boolean;
  treatment: "INPUT" | "READ_ONLY";
}

export interface OwnerFormObservation {
  hasHumanReadableRelationLabel?: boolean;
  name: string;
  supportsNullClear?: boolean;
  treatment: "INPUT" | "READ_ONLY";
}

export interface OwnerTableExpectation {
  name: string;
  relation?: boolean;
}

export interface OwnerTableObservation {
  hasHumanReadableRelationLabel?: boolean;
  name: string;
}

export interface OwnerSurfaceAuditResult {
  duplicateObserved: string[];
  missing: string[];
  pass: boolean;
  unexpected: string[];
  violations: string[];
}

function duplicates(names: string[]) {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) repeated.add(name);
    seen.add(name);
  }
  return [...repeated].sort();
}

export function auditOwnerFormContract(expected: OwnerFormExpectation[], observed: OwnerFormObservation[]): OwnerSurfaceAuditResult {
  const observedByName = new Map(observed.map((field) => [field.name, field]));
  const expectedNames = new Set(expected.map((field) => field.name));
  const missing = expected.filter((field) => !observedByName.has(field.name)).map((field) => field.name);
  const unexpected = observed.filter((field) => !expectedNames.has(field.name)).map((field) => field.name);
  const duplicateObserved = duplicates(observed.map((field) => field.name));
  const violations = expected.flatMap((field) => {
    const actual = observedByName.get(field.name);
    if (!actual) return [field.parentField ? `MISSING_PARENT_FIELD:${field.name}` : `MISSING_FIELD:${field.name}`];
    const fieldViolations: string[] = [];
    if (actual.treatment !== field.treatment) fieldViolations.push(`WRONG_TREATMENT:${field.name}:${field.treatment}:${actual.treatment}`);
    if (field.relation && actual.hasHumanReadableRelationLabel !== true) fieldViolations.push(`RAW_FOREIGN_KEY_ONLY:${field.name}`);
    if (field.nullable && field.treatment === "INPUT" && actual.supportsNullClear !== true) fieldViolations.push(`MISSING_NULL_CLEAR:${field.name}`);
    return fieldViolations;
  });
  violations.push(...duplicateObserved.map((name) => `DUPLICATE_OBSERVED_FIELD:${name}`));
  return { duplicateObserved, missing, pass: violations.length === 0, unexpected, violations };
}

export function auditOwnerTableContract(expected: OwnerTableExpectation[], observed: OwnerTableObservation[]): OwnerSurfaceAuditResult {
  const observedByName = new Map(observed.map((column) => [column.name, column]));
  const expectedNames = new Set(expected.map((column) => column.name));
  const missing = expected.filter((column) => !observedByName.has(column.name)).map((column) => column.name);
  const unexpected = observed.filter((column) => !expectedNames.has(column.name) && column.name !== "actions").map((column) => column.name);
  const duplicateObserved = duplicates(observed.map((column) => column.name));
  const violations = expected.flatMap((column) => {
    const actual = observedByName.get(column.name);
    if (!actual) return [`MISSING_COLUMN:${column.name}`];
    return column.relation && actual.hasHumanReadableRelationLabel !== true ? [`RAW_FOREIGN_KEY_ONLY:${column.name}`] : [];
  });
  violations.push(...duplicateObserved.map((name) => `DUPLICATE_OBSERVED_COLUMN:${name}`));
  return { duplicateObserved, missing, pass: violations.length === 0, unexpected, violations };
}
