import { describe, expect, it } from "vitest";

import {
  assertCanonicalCharacterBreedPolicy,
  canonicalArchitectWitnessGuideData,
  canonicalArchitectWitnessRoster,
  canonicalCharacterId,
  canonicalNonBiologicalCharacterIds,
  canonicalSoulId,
  WITNESS_DEF_ID_PREFIX,
} from "../../src/domain/architect-witness";

describe("canonical Architect and Witness roster", () => {
  it("owns exactly 54 complete and unique department transformations", () => {
    const rows = canonicalArchitectWitnessRoster.ordinaryTransformations;
    expect(rows).toHaveLength(54);
    expect(new Set(rows.map(({ department }) => department)).size).toBe(54);
    expect(rows.map(({ department }) => department)).not.toContain("PATRON");
    expect(rows.map(({ department }) => department)).not.toContain("TECHNOCRAT");
  });

  it("registers WDF as the authored WitnessDef identity key", () => {
    expect(WITNESS_DEF_ID_PREFIX).toBe("WDF");
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

  it("inherits Witness demographics from the source Architect with the two owner-locked gender overrides", () => {
    for (const row of canonicalArchitectWitnessGuideData.architects) {
      expect(row.character.skinScaleColor, `${row.character.characterId}.skinScaleColor`).toBeTruthy();
      expect(row.character.hairFurColor, `${row.character.characterId}.hairFurColor`).toBeTruthy();
      expect(row.character.eyeColor, `${row.character.characterId}.eyeColor`).toBeTruthy();
      expect(row.character.clothing, `${row.character.characterId}.clothing`).toBeTruthy();
    }

    const architectById = new Map(canonicalArchitectWitnessGuideData.architects.map((row) => [row.character.characterId, row.character]));
    const genderOverrides = new Map([
      ["CHA_WITNESS_OF_THE_LOOM", "MALE"],
      ["CHA_WITNESS_OF_PATCHWORK", "FEMALE"],
    ]);
    for (const row of canonicalArchitectWitnessGuideData.witnesses) {
      const source = architectById.get(row.witness.architectCharacterId);
      expect(row.character.age, `${row.character.characterId}.age`).toBe(source?.age);
      expect(row.character.age, `${row.character.characterId}.age`).toMatch(/\S/);
      expect(row.character.gender, `${row.character.characterId}.gender`).toBe(genderOverrides.get(row.character.characterId) ?? source?.gender);
    }
  });

  it("locks the complete Hammer regression chain without inventing unauthored appearance", () => {
    const architect = canonicalArchitectWitnessGuideData.architects.find(({ character }) => character.characterId === "CHA_ANDREI_MIHAI_POPESCU");
    const witness = canonicalArchitectWitnessGuideData.witnesses.find(({ character }) => character.characterId === "CHA_WITNESS_OF_THE_HAMMER");
    const definition = canonicalArchitectWitnessGuideData.witnessDefs.find(({ witnessDefId }) => witnessDefId === "WDF_WITNESS_OF_THE_HAMMER");
    const soul = canonicalArchitectWitnessGuideData.souls.find(({ soulId }) => soulId === "SOUL_ANDREI_MIHAI_POPESCU");

    expect(architect).toMatchObject({ architect: { department: "JUSTICE" }, character: { displayName: "Andrei Mihai Popescu", gender: "MALE" } });
    expect(witness).toMatchObject({
      character: { age: "53", breedId: "BRD_MINOTAUR", displayName: "The Witness of the Hammer", gender: "MALE", soulId: "SOUL_ANDREI_MIHAI_POPESCU", worldKey: "RUIN" },
      witness: { architectCharacterId: "CHA_ANDREI_MIHAI_POPESCU", trueFlawName: "Retaliation", witnessDefId: "WDF_WITNESS_OF_THE_HAMMER" },
    });
    expect(definition).toMatchObject({ architectSoulId: "SOUL_ANDREI_MIHAI_POPESCU", department: "JUSTICE", kernelKey: "REDRESS", apparentDomain: "Restitution", realDomain: "Retaliation", worldKey: "RUIN" });
    expect(soul?.name).toBe("Andrei Mihai Popescu");
    for (const field of ["skinScaleColor", "hairFurColor", "eyeColor", "clothing"] as const) expect(witness?.character[field]).toBeNull();
  });

  it("defines the complete first-class WitnessDef persistence shape and valid world/book distribution", () => {
    const canonicalKeys = Object.keys(canonicalArchitectWitnessGuideData.witnessDefs[0]!).sort();
    expect(canonicalKeys).toEqual([
      "apparentDomain", "architectSoulId", "bookNumber", "color", "department", "kernelKey", "name", "realDomain", "witnessDefId", "worldKey",
    ]);
    const perWorld = Map.groupBy(canonicalArchitectWitnessGuideData.witnessDefs, ({ worldKey }) => worldKey);
    expect([...perWorld.values()].map((definitions) => definitions.length).sort()).toEqual([18, 18, 18]);
    for (const definition of canonicalArchitectWitnessGuideData.witnessDefs) {
      expect(definition.kernelKey.trim(), definition.witnessDefId).not.toBe("");
      expect(definition.bookNumber, definition.witnessDefId).toBeGreaterThanOrEqual(1);
      expect(definition.bookNumber, definition.witnessDefId).toBeLessThanOrEqual(18);
    }
  });

  it("uses deterministic Character and Soul identities without duplicating Guide forms", () => {
    expect(canonicalCharacterId("Kris Maarja Tamm")).toBe("CHA_KRIS_MAARJA_TAMM");
    expect(canonicalSoulId("Kris Maarja Tamm")).toBe("SOUL_KRIS_MAARJA_TAMM");
    expect(canonicalCharacterId("The Witness of the Summit")).toBe("CHA_WITNESS_OF_THE_SUMMIT");
    expect(canonicalArchitectWitnessRoster.presidingArchitects).toHaveLength(2);
    expect(canonicalArchitectWitnessRoster.otherCharacters).toHaveLength(2);
    expect(canonicalArchitectWitnessRoster.otherCharacters).toContainEqual(expect.objectContaining({
      displayName: "Mother",
      breedId: null,
      guideForm: "The Steward",
      identityKind: "AI",
    }));
  });

  it("locks the three static Guide mappings without creating Guide identities", () => {
    expect(canonicalArchitectWitnessGuideData.guides.guides.map(({ title, characterId, soulId, createsAdditionalCharacter }) => ({
      title, characterId, soulId, createsAdditionalCharacter,
    }))).toEqual([
      { title: "The Overseer", characterId: "CHA_HANS_HALYCON_HOHENZOLLERN", soulId: "SOUL_HANS_HALYCON_HOHENZOLLERN", createsAdditionalCharacter: false },
      { title: "The Herald", characterId: "CHA_FRANK_ADRIAN_VOSS", soulId: "SOUL_FRANK_ADRIAN_VOSS", createsAdditionalCharacter: false },
      { title: "The Steward", characterId: "CHA_MOTHER", soulId: "SOUL_MOTHER", createsAdditionalCharacter: false },
    ]);
  });

  it("allows only the canonical non-biological registry to omit Breed", () => {
    expect(canonicalNonBiologicalCharacterIds).toEqual(["CHA_MOTHER"]);
    expect(() => assertCanonicalCharacterBreedPolicy({ characterId: "CHA_MOTHER", breedId: null })).not.toThrow();
    expect(() => assertCanonicalCharacterBreedPolicy({ characterId: "CHA_MOTHER", breedId: "BRD_FAKE" })).toThrow(/must have breedId null/);
    for (const row of canonicalArchitectWitnessGuideData.architects) {
      expect(row.character.breedId, row.character.characterId).not.toBeNull();
      expect(() => assertCanonicalCharacterBreedPolicy(row.character)).not.toThrow();
    }
    for (const row of canonicalArchitectWitnessGuideData.witnesses) {
      expect(row.character.breedId, row.character.characterId).not.toBeNull();
      expect(() => assertCanonicalCharacterBreedPolicy(row.character)).not.toThrow();
    }
    for (const characterId of ["CHA_KRIS_MAARJA_TAMM", "CHA_WITNESS_OF_THE_SUMMIT", "CHA_FRANK_ADRIAN_VOSS", "CHA_UNKNOWN"]) {
      expect(() => assertCanonicalCharacterBreedPolicy({ characterId, breedId: null })).toThrow(/Breed is required/);
    }
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
