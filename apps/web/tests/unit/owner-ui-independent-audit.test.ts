import { describe, expect, it } from "vitest";

import {
  auditOwnerFormContract,
  auditOwnerTableContract,
  type OwnerFormExpectation,
  type OwnerFormObservation,
} from "../../src/domain/owner-ui-independent-audit";

const formExpected: OwnerFormExpectation[] = [
  { name: "displayName", treatment: "INPUT" },
  { name: "characterId", treatment: "READ_ONLY" },
  { name: "breedId", nullable: false, relation: true, treatment: "INPUT" },
  { name: "occupationId", nullable: true, relation: true, treatment: "INPUT" },
  { name: "character.displayName", parentField: true, treatment: "READ_ONLY" },
];

const formObserved: OwnerFormObservation[] = [
  { name: "displayName", treatment: "INPUT" },
  { name: "characterId", treatment: "READ_ONLY" },
  { hasHumanReadableRelationLabel: true, name: "breedId", supportsNullClear: false, treatment: "INPUT" },
  { hasHumanReadableRelationLabel: true, name: "occupationId", supportsNullClear: true, treatment: "INPUT" },
  { name: "character.displayName", treatment: "READ_ONLY" },
];

describe("independent owner UI audit", () => {
  it("passes only when independently expected and observed form contracts agree", () => {
    expect(auditOwnerFormContract(formExpected, formObserved)).toMatchObject({ pass: true, violations: [] });
  });

  it.each([
    ["canonical form field", formObserved.filter(({ name }) => name !== "displayName"), "MISSING_FIELD:displayName"],
    ["read-only identity", formObserved.filter(({ name }) => name !== "characterId"), "MISSING_FIELD:characterId"],
    ["relation label", formObserved.map((field) => field.name === "breedId" ? { ...field, hasHumanReadableRelationLabel: false } : field), "RAW_FOREIGN_KEY_ONLY:breedId"],
    ["nullable clear path", formObserved.map((field) => field.name === "occupationId" ? { ...field, supportsNullClear: false } : field), "MISSING_NULL_CLEAR:occupationId"],
    ["subtype parent field", formObserved.filter(({ name }) => name !== "character.displayName"), "MISSING_PARENT_FIELD:character.displayName"],
  ])("fails when the observed form drops the %s", (_label, observed, violation) => {
    expect(auditOwnerFormContract(formExpected, observed)).toMatchObject({ pass: false });
    expect(auditOwnerFormContract(formExpected, observed).violations).toContain(violation);
  });

  it("fails when a rendered table drops one expected column or its relation resolver", () => {
    const expected = [
      { name: "name" },
      { name: "breedId", relation: true },
      { name: "status" },
    ];
    const complete = [
      { hasHumanReadableRelationLabel: false, name: "name" },
      { hasHumanReadableRelationLabel: true, name: "breedId" },
      { hasHumanReadableRelationLabel: false, name: "status" },
    ];
    expect(auditOwnerTableContract(expected, complete).pass).toBe(true);
    expect(auditOwnerTableContract(expected, complete.filter(({ name }) => name !== "status")).violations).toContain("MISSING_COLUMN:status");
    expect(auditOwnerTableContract(expected, complete.map((column) => column.name === "breedId" ? { ...column, hasHumanReadableRelationLabel: false } : column)).violations).toContain("RAW_FOREIGN_KEY_ONLY:breedId");
  });
});
