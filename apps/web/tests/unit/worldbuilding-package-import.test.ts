import { describe, expect, it } from "vitest";

import { findCanonicalRowDrift, mergeCanonicalRows, orderBreedRowsParentFirst } from "../../src/server/worldbuilding-package-import";

describe("canonical WorldBuilding package assembly", () => {
  it("merges exact IDs and applies owner-supplied patches without changing identity", () => {
    expect(mergeCanonicalRows(
      [{ speciesId: "SPC_AMBYSTOMA_MEXICANUM", name: "Axolotl", anthropomorphization: null }],
      [],
      [{ speciesId: "SPC_AMBYSTOMA_MEXICANUM", anthropomorphization: "Sapient Beast rendering." }],
      "speciesId",
    )).toEqual([{ speciesId: "SPC_AMBYSTOMA_MEXICANUM", name: "Axolotl", anthropomorphization: "Sapient Beast rendering." }]);
  });

  it("orders Breed parents before children while preserving canonical IDs", () => {
    expect(orderBreedRowsParentFirst([
      { breedId: "BRD_CHILD", parentBreedId: "BRD_PARENT" },
      { breedId: "BRD_PARENT", parentBreedId: null },
    ]).map(({ breedId }) => breedId)).toEqual(["BRD_PARENT", "BRD_CHILD"]);
  });

  it("fails closed on missing or cyclic Breed parents", () => {
    expect(() => orderBreedRowsParentFirst([{ breedId: "BRD_CHILD", parentBreedId: "BRD_MISSING" }])).toThrow("BRD_MISSING");
    expect(() => orderBreedRowsParentFirst([
      { breedId: "BRD_A", parentBreedId: "BRD_B" },
      { breedId: "BRD_B", parentBreedId: "BRD_A" },
    ])).toThrow("cycle");
  });

  it("audits authored package fields instead of accepting matching counts alone", () => {
    expect(findCanonicalRowDrift(
      [{ speciesId: "SPC_HOMO_SAPIENS", name: "Human", clothing: null }],
      [{ speciesId: "SPC_HOMO_SAPIENS", name: "Humans", clothing: null }],
      "speciesId",
    )).toEqual(["SPC_HOMO_SAPIENS:name"]);
  });
});
