import { describe, expect, it } from "vitest";

import {
  canonicalArchitectWitnessRoster,
  canonicalCharacterId,
  canonicalSoulId,
} from "../../src/domain/architect-witness";

describe("canonical Architect and Witness roster", () => {
  it("owns exactly 54 complete and unique department transformations", () => {
    const rows = canonicalArchitectWitnessRoster.ordinaryTransformations;
    expect(rows).toHaveLength(54);
    expect(new Set(rows.map(({ department }) => department)).size).toBe(54);
    expect(rows.map(({ department }) => department)).not.toContain("PATRON");
    expect(rows.map(({ department }) => department)).not.toContain("TECHNOCRAT");
  });

  it("locks the two replacement seats", () => {
    expect(canonicalArchitectWitnessRoster.ordinaryTransformations).toContainEqual(expect.objectContaining({
      architectName: "Daniyar Serikuly Beketov",
      department: "SPONSORSHIP",
      kernel: "PRESTIGE",
      witnessName: "The Witness of the Spotlight",
      witnessBreedId: "BRD_INDIAN_PEAFOWL",
    }));
    expect(canonicalArchitectWitnessRoster.ordinaryTransformations).toContainEqual(expect.objectContaining({
      architectName: "Temüülen Erdenebat Ganbold",
      department: "INNOVATION",
      kernel: "RIVALRY",
      witnessName: "The Witness of the Arena",
      witnessBreedId: "BRD_RED_DEER",
    }));
  });

  it("locks the two Beast-qualified Witness Breed corrections", () => {
    expect(canonicalArchitectWitnessRoster.ordinaryTransformations).toContainEqual(expect.objectContaining({
      witnessName: "The Witness of the Spring",
      witnessBreedId: "BRD_AXOLOTL_BEAST",
    }));
    expect(canonicalArchitectWitnessRoster.ordinaryTransformations).toContainEqual(expect.objectContaining({
      witnessName: "The Witness of the Compass",
      witnessBreedId: "BRD_HOMING_PIGEON_BEAST",
    }));
  });

  it("uses deterministic Character and Soul identities without duplicating Guide forms", () => {
    expect(canonicalCharacterId("Kris Maarja Tamm")).toBe("CHA_KRIS_MAARJA_TAMM");
    expect(canonicalSoulId("Kris Maarja Tamm")).toBe("SOUL_KRIS_MAARJA_TAMM");
    expect(canonicalCharacterId("The Witness of the Summit")).toBe("CHA_WITNESS_OF_THE_SUMMIT");
    expect(canonicalArchitectWitnessRoster.presidingArchitects).toHaveLength(2);
    expect(canonicalArchitectWitnessRoster.otherCharacters).toHaveLength(1);
    expect(canonicalArchitectWitnessRoster.omittedIdentities[0].displayName).toBe("Mother");
  });

  it("keeps every paired-body presentation as two roster identities", () => {
    const witnesses = new Set(canonicalArchitectWitnessRoster.ordinaryTransformations.map(({ witnessName }) => witnessName));
    for (const pair of canonicalArchitectWitnessRoster.compositePresentations) {
      expect(pair[0]).not.toBe(pair[1]);
      expect(witnesses.has(pair[0])).toBe(true);
      expect(witnesses.has(pair[1])).toBe(true);
    }
  });
});
