import { describe, expect, it } from "vitest";

import contractData from "../../src/data/entity-admin-contract.json";
import {
  buildOwnerFormPlan,
  ownerFormSections,
  subtypeParentEntity,
} from "../../src/domain/owner-form-contract";
import { lookupPresentationRule } from "../../src/domain/lookup-presentation";

describe("universal owner form contract", () => {
  it("represents every canonical field exactly once as an input or read-only value", () => {
    for (const [entity, contract] of Object.entries(contractData.entities)) {
      const plan = buildOwnerFormPlan(entity, contract);
      expect(plan.map(({ name }) => name).sort(), entity).toEqual(
        contract.auditFields.map(({ name }) => name).sort(),
      );
      expect(new Set(plan.map(({ name }) => name)).size, entity).toBe(contract.auditFields.length);
      expect(plan.every(({ treatment }) => treatment === "INPUT" || treatment === "READ_ONLY"), entity).toBe(true);
    }
  });

  it("turns every owning foreign key into a human-readable searchable relation control", () => {
    for (const [entity, contract] of Object.entries(contractData.entities)) {
      const plan = buildOwnerFormPlan(entity, contract);
      for (const relation of contract.auditFields.filter((field) => field.kind === "relation" && field.relationFromFields?.length)) {
        expect(() => lookupPresentationRule(relation.type), `${entity}.${relation.name}`).not.toThrow();
        for (const foreignKey of relation.relationFromFields ?? []) {
          expect(plan.find(({ name }) => name === foreignKey), `${entity}.${foreignKey}`).toMatchObject({
            control: "RELATION_LOOKUP",
            relationField: relation.name,
            relationType: relation.type,
            treatment: "INPUT",
          });
        }
      }
    }
  });

  it("composes Character parent data into every Character subtype editor", () => {
    expect(subtypeParentEntity("Architect")).toBe("Character");
    expect(subtypeParentEntity("Witness")).toBe("Character");
    expect(subtypeParentEntity("Companion")).toBe("Character");
    expect(subtypeParentEntity("Breed")).toBeNull();
  });

  it("uses the exact WitnessDef sections and explicit spectral percentage control", () => {
    expect(ownerFormSections("WitnessDef")).toEqual([
      "Identity",
      "Source Architect / Soul",
      "Domains",
      "Spectral Color",
      "Related / Read-only",
    ]);
    const plan = buildOwnerFormPlan("WitnessDef", contractData.entities.WitnessDef);
    expect(plan.find(({ name }) => name === "color")).toMatchObject({
      control: "SPECTRAL_COLOR",
      section: "Spectral Color",
      treatment: "INPUT",
    });
  });
});
