import { describe, expect, it } from "vitest";

import contractData from "../../src/data/entity-admin-contract.json";
import { orderOwnerTableFields } from "../../src/domain/owner-table-field-order";

describe("deterministic owner table field order", () => {
  it("retains every canonical field exactly once for every active entity", () => {
    for (const [entity, contract] of Object.entries(contractData.entities)) {
      const ordered = orderOwnerTableFields(entity, contract.idField, contract.auditFields);
      expect(ordered).toHaveLength(contract.auditFields.length);
      expect(new Set(ordered.map(({ name }) => name)).size, entity).toBe(contract.auditFields.length);
      expect([...ordered.map(({ name }) => name)].sort(), entity).toEqual(
        [...contract.auditFields.map(({ name }) => name)].sort(),
      );
    }
  });

  it("uses the owner-locked relation-label and raw-ID sequence for relation-heavy entities", () => {
    const breed = orderOwnerTableFields("Breed", contractData.entities.Breed.idField, contractData.entities.Breed.auditFields);
    expect(breed.slice(0, 12).map(({ name }) => name)).toEqual([
      "name", "breedId", "species", "speciesId", "parentBreed", "parentBreedId",
      "culture", "cultureId", "populationKind", "groupId", "personality", "personalityId",
    ]);
    const witness = orderOwnerTableFields("Witness", contractData.entities.Witness.idField, contractData.entities.Witness.auditFields);
    expect(witness.slice(0, 8).map(({ name }) => name)).toEqual([
      "character", "characterId", "witnessDef", "witnessDefId",
      "architect", "architectCharacterId", "legendaryReward", "legendaryRewardId",
    ]);
  });
});
