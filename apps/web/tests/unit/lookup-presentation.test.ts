import { describe, expect, it } from "vitest";

import lookupData from "../../src/data/lookup-presentation.json";
import { LookupPresentationError, lookupPresentationFor, lookupSearchText } from "../../src/domain/lookup-presentation";

describe("owner-authored lookup presentation", () => {
  it("keeps technical identity searchable while defining semantic Witness context", () => {
    expect(Object.keys(lookupData.lookupPresentation)).toHaveLength(17);
    expect(lookupData.lookupPresentation.Character).toEqual({ primary: "displayName", technicalId: "characterId" });
    expect(lookupData.lookupPresentation.Witness).toEqual({
      primary: "character.displayName",
      technicalId: "characterId",
      context: [
        { path: "character.worldKey", label: "World" },
        { path: "character.breed.name", label: "Breed" },
        { path: "architect.character.displayName", label: "Source Architect" },
      ],
    });
  });

  it("resolves every registered presentation rule to a human label plus technical identity", () => {
    const cases: Record<string, { record: Record<string, unknown>; primary: string; technicalId: string }> = {
      Character: { record: { displayName: "Ari", characterId: "CHA_ARI" }, primary: "Ari", technicalId: "CHA_ARI" },
      Architect: { record: { characterId: "CHA_HANS", character: { displayName: "Hans" }, department: "ASTRONOMY" }, primary: "Hans", technicalId: "CHA_HANS" },
      Witness: { record: { characterId: "CHA_WIT", character: { displayName: "Mara", worldKey: "RUIN", breed: { name: "Minotaur" } }, architect: { character: { displayName: "Hans" } } }, primary: "Mara", technicalId: "CHA_WIT" },
      WitnessDef: { record: { witnessDefId: "WDF_EMBERS", name: "Embers", department: "JUSTICE", sourceArchitect: { character: { displayName: "Hans" } } }, primary: "Embers", technicalId: "WDF_EMBERS" },
      Companion: { record: { characterId: "CHA_COMP", companionKey: "FOX", character: { displayName: "Fox", worldKey: "CONCORD" } }, primary: "Fox", technicalId: "CHA_COMP" },
      CompanionDef: { record: { companionKey: "FOX", concordCharacter: { displayName: "Concord Fox" }, ruinCharacter: { displayName: "Ruin Fox" }, schismCharacter: { displayName: "Schism Fox" } }, primary: "Companion FOX", technicalId: "FOX" },
      Species: { record: { speciesId: "SPC_HUMAN", name: "Human" }, primary: "Human", technicalId: "SPC_HUMAN" },
      Taxonomy: { record: { taxonomyLevelId: "TAX_GENUS_HOMO", name: "Homo", commonName: "humans" }, primary: "Homo", technicalId: "TAX_GENUS_HOMO" },
      Culture: { record: { cultureId: "CUL_NORTH", name: "North" }, primary: "North", technicalId: "CUL_NORTH" },
      Breed: { record: { breedId: "BRD_NORTH", name: "Northerner", species: { name: "Human" }, culture: { name: "North" }, groupId: "H01" }, primary: "Northerner", technicalId: "BRD_NORTH" },
      Occupation: { record: { occupationId: "OCC_SMITH", name: "Smith" }, primary: "Smith", technicalId: "OCC_SMITH" },
      LegendaryReward: { record: { legendaryRewardId: "REW_STAR", name: "Star" }, primary: "Star", technicalId: "REW_STAR" },
      Constellation: { record: { constellationId: "CON_STAR", name: "Star" }, primary: "Star", technicalId: "CON_STAR" },
      Settlement: { record: { settlementId: "SET_HOME", name: "Home" }, primary: "Home", technicalId: "SET_HOME" },
      Site: { record: { siteId: "SIT_1", regionId: "R1", candidateType: "CITY" }, primary: "CITY site", technicalId: "SIT_1" },
      Region: { record: { regionId: "R1", canonicalRegionName: "Northreach" }, primary: "Northreach", technicalId: "R1" },
      Soul: { record: { soulId: "SOUL_1", name: "Ari" }, primary: "Ari", technicalId: "SOUL_1" },
    };
    expect(Object.keys(cases).sort()).toEqual(Object.keys(lookupData.lookupPresentation).sort());
    for (const [entity, fixture] of Object.entries(cases)) {
      const presentation = lookupPresentationFor(entity, fixture.record);
      expect(presentation?.primary, entity).toBe(fixture.primary);
      expect(presentation?.technicalId, entity).toBe(fixture.technicalId);
    }
  });

  it("adds compact labeled context without repeating the Breed label or ID", () => {
    expect(lookupPresentationFor("Breed", { breedId: "BRD_AARDVARK", name: "Aardvark", species: { name: "Aardvark" }, culture: { name: "Burrow Folk" }, groupId: "B07" })).toEqual({
      primary: "Aardvark",
      technicalId: "BRD_AARDVARK",
      context: ["Species: Aardvark", "Culture: Burrow Folk", "Breed group: Elephants, Hyraxes & Afrotherians"],
    });
  });

  it("searches by human label, hidden raw ID, or semantic context", () => {
    const witness = lookupPresentationFor("Witness", { characterId: "CHA_WITNESS", character: { displayName: "Mara Vale", worldKey: "RUIN", breed: { name: "Minotaur" } }, architect: { character: { displayName: "Hans Halycon Hohenzollern" } } });
    expect(lookupSearchText(witness)).toContain("mara vale");
    expect(lookupSearchText(witness)).toContain("cha_witness");
    expect(lookupSearchText(witness)).toContain("source architect: hans halycon hohenzollern");
  });

  it("renders null as no lookup and fails closed when a human label is absent", () => {
    expect(lookupPresentationFor("Culture", null)).toBeNull();
    expect(() => lookupPresentationFor("Culture", { cultureId: "CUL_1" })).toThrow(LookupPresentationError);
    expect(() => lookupPresentationFor("Unknown", { id: "1" })).toThrow(LookupPresentationError);
  });
});
