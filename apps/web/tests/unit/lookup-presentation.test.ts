import { describe, expect, it } from "vitest";

import lookupData from "../../src/data/lookup-presentation.json";
import {
  LookupPresentationError,
  lookupPresentationFor,
  lookupSearchText,
} from "../../src/domain/lookup-presentation";

describe("owner-authored lookup presentation", () => {
  it("retains every owner-locked entity rule and the exact Witness identity chain", () => {
    expect(Object.keys(lookupData.lookupPresentation)).toHaveLength(16);
    expect(lookupData.lookupPresentation.Character).toEqual({ primary: "displayName", secondary: "characterId" });
    expect(lookupData.lookupPresentation.Witness).toEqual({
      primary: "character.displayName",
      secondary: "characterId",
      context: ["witnessDef.name", "architect.character.displayName"],
    });
    expect(lookupData.lookupPresentation.WitnessDef).toEqual({
      primary: "name",
      secondary: "witnessDefId",
      context: ["sourceArchitect.character.displayName", "architectSoulId"],
    });
  });

  it("resolves every registered presentation rule", () => {
    const cases: Record<string, { record: Record<string, unknown>; primary: string; secondary: string | null; derivedSecondary?: string }> = {
      Character: { record: { displayName: "Ari", characterId: "CHA_ARI" }, primary: "Ari", secondary: "CHA_ARI" },
      Architect: { record: { characterId: "CHA_HANS", character: { displayName: "Hans" }, department: "ASTRONOMY" }, primary: "Hans", secondary: "CHA_HANS" },
      Witness: { record: { characterId: "CHA_WIT", character: { displayName: "Mara" }, witnessDef: { name: "Embers" }, architect: { character: { displayName: "Hans" } } }, primary: "Mara", secondary: "CHA_WIT" },
      WitnessDef: { record: { witnessDefId: "WDF_EMBERS", name: "Embers", sourceArchitect: { character: { displayName: "Hans" } }, architectSoulId: "SOUL_HANS" }, primary: "Embers", secondary: "WDF_EMBERS" },
      Companion: { record: { characterId: "CHA_COMP", companionKey: "FOX", character: { displayName: "Fox", worldKey: "CONCORD" } }, primary: "Fox", secondary: "CHA_COMP" },
      CompanionDef: { record: { companionKey: "FOX", concordCharacter: { displayName: "Concord Fox" }, ruinCharacter: { displayName: "Ruin Fox" }, schismCharacter: { displayName: "Schism Fox" } }, primary: "Companion FOX", secondary: "FOX" },
      Species: { record: { speciesId: "SPC_HUMAN", name: "Human" }, primary: "Human", secondary: "SPC_HUMAN" },
      Culture: { record: { cultureId: "CUL_NORTH", name: "North" }, primary: "North", secondary: "CUL_NORTH" },
      Breed: { record: { breedId: "BRD_NORTH", name: "Northerner", species: { name: "Human" }, culture: { name: "North" } }, primary: "Northerner", secondary: "BRD_NORTH" },
      Occupation: { record: { occupationId: "OCC_SMITH", name: "Smith" }, primary: "Smith", secondary: "OCC_SMITH" },
      LegendaryReward: { record: { legendaryRewardId: "REW_STAR", name: "Star" }, primary: "Star", secondary: "REW_STAR" },
      Constellation: { record: { constellationId: "CON_STAR", name: "Star" }, primary: "Star", secondary: "CON_STAR" },
      Settlement: { record: { settlementId: "SET_HOME", name: "Home" }, primary: "Home", secondary: "SET_HOME" },
      Site: { record: { siteId: "SIT_1", regionId: "R1", candidateType: "CITY" }, primary: "SIT_1 — R1 — CITY", secondary: "SIT_1" },
      Region: { record: { regionId: "R1", canonicalRegionName: "Northreach" }, primary: "R1 — Northreach", secondary: "R1" },
      Soul: { record: { soulId: "SOUL_1" }, primary: "SOUL_1", secondary: "Ari — Architect", derivedSecondary: "Ari — Architect" },
    };
    expect(Object.keys(cases).sort()).toEqual(Object.keys(lookupData.lookupPresentation).sort());
    for (const [entity, fixture] of Object.entries(cases)) {
      const presentation = lookupPresentationFor(entity, fixture.record, { derivedSecondary: fixture.derivedSecondary });
      expect(presentation?.primary, entity).toBe(fixture.primary);
      expect(presentation?.secondary, entity).toBe(fixture.secondary);
    }
  });

  it("renders named and compound lookups name-first with canonical ID second", () => {
    expect(lookupPresentationFor("Breed", {
      breedId: "BRD_AARDVARK",
      name: "Aardvark",
      species: { name: "Aardvark" },
      culture: { name: "Burrow Folk" },
    })).toEqual({
      primary: "Aardvark",
      secondary: "BRD_AARDVARK",
      context: ["Aardvark", "Burrow Folk"],
    });
    expect(lookupPresentationFor("Site", {
      siteId: "SIT_R1_001",
      regionId: "R1",
      candidateType: "CITY",
    })).toEqual({
      primary: "SIT_R1_001 — R1 — CITY",
      secondary: "SIT_R1_001",
      context: [],
    });
  });

  it("searches the same lookup by human-readable label, raw ID, or context", () => {
    const witness = lookupPresentationFor("Witness", {
      characterId: "CHA_WITNESS",
      character: { displayName: "Mara Vale" },
      witnessDef: { name: "Witness of Embers" },
      architect: { character: { displayName: "Hans Halycon Hohenzollern" } },
    });
    expect(lookupSearchText(witness)).toContain("mara vale");
    expect(lookupSearchText(witness)).toContain("cha_witness");
    expect(lookupSearchText(witness)).toContain("hans halycon hohenzollern");
  });

  it("renders null as no lookup and fails closed when a required human label is absent", () => {
    expect(lookupPresentationFor("Culture", null)).toBeNull();
    expect(() => lookupPresentationFor("Culture", { cultureId: "CUL_1" })).toThrow(LookupPresentationError);
    expect(() => lookupPresentationFor("Unknown", { id: "1" })).toThrow(LookupPresentationError);
  });
});
