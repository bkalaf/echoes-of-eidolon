import { describe, expect, it } from "vitest";

import contractData from "../../src/data/entity-admin-contract.json";
import {
  adminFieldControl,
  validateAdminEntityDraft,
  type EntityFormField,
} from "../../src/domain/entity-form";

describe("all canonical entity forms", () => {
  it("assigns a concrete typed control to every editable field on every registered entity", () => {
    const entities = contractData.entities as Record<string, { fields: EntityFormField[]; idField: string }>;
    expect(Object.keys(entities)).toHaveLength(34);
    for (const [entity, contract] of Object.entries(entities)) {
      expect(contract.fields.length, `${entity} must have editable fields`).toBeGreaterThan(0);
      for (const field of contract.fields) {
        expect(adminFieldControl(entity, contract.idField, field), `${entity}.${field.name}`).not.toBe("UNSUPPORTED");
      }
    }
  });

  it("requires every excluded persisted field to retain an explicit workflow reason", () => {
    const entities = contractData.entities as Record<string, { auditFields: Array<{ editability: string; exclusionReason: string | null; name: string }> }>;
    for (const [entity, contract] of Object.entries(entities)) {
      for (const field of contract.auditFields.filter((entry) => entry.editability === "EXCLUDED")) {
        expect(field.exclusionReason, `${entity}.${field.name}`).toBeTruthy();
      }
    }
  });

  it("validates required, numeric, list, and clothing controls before submission", () => {
    const fields: EntityFormField[] = [
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "recordId", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "year", type: "Int" },
      { enumValues: [], hasDefault: false, isList: true, isRequired: true, kind: "scalar", name: "authors", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "clothing", type: "String" },
    ];
    const errors = validateAdminEntityDraft("Breed", "recordId", fields, { recordId: "", year: "one", authors: "[]", clothing: "Civilian: coat" });
    expect(errors).toEqual(expect.arrayContaining([
      "recordId is required.",
      "year must be a valid Int.",
      "authors requires at least one value.",
      expect.stringContaining("clothing requires section Light armor"),
    ]));
  });
});
