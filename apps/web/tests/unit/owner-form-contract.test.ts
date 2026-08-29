import { describe, expect, it } from "vitest";

import contractData from "../../src/data/entity-admin-contract.json";
import {
  buildOwnerFormPlan,
  ownerFormSections,
  subtypeParentEntity,
} from "../../src/domain/owner-form-contract";
import { lookupPresentationRule } from "../../src/domain/lookup-presentation";

describe("universal owner form contract", () => {
  it("represents every persisted scalar once and removes owning relation/FK duplication", () => {
    for (const [entity, contract] of Object.entries(contractData.entities)) {
      const plan = buildOwnerFormPlan(entity, contract);
      const owningRelations = contract.auditFields.filter((field) => field.kind === "relation" && field.relationFromFields?.length);
      if (owningRelations.length) expect(plan.map(({ name }) => name), entity).not.toEqual(expect.arrayContaining(owningRelations.map(({ name }) => name)));
      for (const relation of owningRelations) for (const foreignKey of relation.relationFromFields ?? []) {
        expect(plan.filter(({ name }) => name === foreignKey), `${entity}.${relation.name}`).toHaveLength(1);
      }
      expect(new Set(plan.map(({ name }) => name)).size, entity).toBe(plan.length);
      expect(plan.every(({ treatment }) => treatment === "INPUT" || treatment === "READ_ONLY"), entity).toBe(true);
    }
  });

  it("uses the required semantic Witness composition", () => {
    expect(ownerFormSections("Witness")).toEqual(["Character", "Witness definition", "Source Architect", "Soul continuity", "Witness-specific narrative data", "Rewards / constellations", "Technical details"]);
    const plan = buildOwnerFormPlan("Witness", contractData.entities.Witness);
    expect(plan.find(({ name }) => name === "architectCharacterId")).toMatchObject({ label: "Architect", relationField: "architect", section: "Source Architect" });
    expect(plan.some(({ name }) => name === "architect")).toBe(false);
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
      "World / Book / Kernel",
      "Domains",
      "Spectral Color",
      "Related / Read-only",
      "Technical details",
    ]);
    const plan = buildOwnerFormPlan("WitnessDef", contractData.entities.WitnessDef);
    expect(plan.find(({ name }) => name === "color")).toMatchObject({
      control: "SPECTRAL_COLOR",
      section: "Spectral Color",
      treatment: "INPUT",
    });
    for (const name of ["worldKey", "bookNumber", "kernelKey"]) {
      expect(plan.find((field) => field.name === name)).toMatchObject({ section: "World / Book / Kernel", treatment: "INPUT" });
    }
  });
});
