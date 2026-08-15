import { describe, expect, it } from "vitest";

import {
  BREED_GROUPS,
  BREED_GROUP_IDS,
  WORLD_BUILDING_ENUMS,
  canonicalEntityId,
  canonicalIdToken,
  canonicalTaxonomyLevelId,
  deriveEconomicForm,
  derivePoliticalForm,
  resolvePresentation,
  validateBreed,
  validateSpecies,
  validateTaxonomy,
} from "../../src/domain/worldbuilding";

describe("WorldBuilding v3 simple domain", () => {
  it("derives final persistence IDs only from finalized canonical names", () => {
    expect(canonicalIdToken("Ancient Levantine / Nabataean-Phoenician")).toBe("ANCIENT_LEVANTINE_NABATAEAN_PHOENICIAN");
    expect(canonicalIdToken("Taíno")).toBe("TAI_NO");
    expect(canonicalEntityId("SPECIES", "Homo sapiens")).toBe("SPC_HOMO_SAPIENS");
    expect(canonicalEntityId("CULTURE", "Arabian Peninsula Arab")).toBe("CLT_ARABIAN_PENINSULA_ARAB");
    expect(canonicalEntityId("BREED", "Death's-head hawkmoth")).toBe("BRD_DEATH_S_HEAD_HAWKMOTH");
    expect(canonicalTaxonomyLevelId("GENUS", "Homo")).toBe("TAX_GENUS_HOMO");
  });

  it("pins the exact controlled registries", () => {
    expect(BREED_GROUP_IDS).toHaveLength(84);
    expect(new Set(BREED_GROUP_IDS)).toHaveLength(84);
    expect(Object.keys(BREED_GROUPS)).toEqual(BREED_GROUP_IDS);
    expect(Object.values(BREED_GROUPS).filter((group) => group.speciesKind === "BEAST")).toHaveLength(24);
    expect(Object.values(BREED_GROUPS).filter((group) => group.speciesKind === "HUMAN")).toHaveLength(24);
    expect(Object.values(BREED_GROUPS).filter((group) => group.speciesKind === "MYTHOS")).toHaveLength(24);
    expect(Object.values(BREED_GROUPS).filter((group) => group.speciesKind === "PET")).toHaveLength(12);
    expect(WORLD_BUILDING_ENUMS.FoodBroadCategory).toHaveLength(7);
    expect(WORLD_BUILDING_ENUMS.FoodSpecific).toHaveLength(64);
    expect(WORLD_BUILDING_ENUMS.TerrainBroad).toHaveLength(12);
    expect(WORLD_BUILDING_ENUMS.SpecificTerrain).toHaveLength(63);
  });

  it("validates recursive taxonomy rank order, text, and cycles", () => {
    const taxonomy = {
      taxonomyLevelId: "TAX_SPECIES_HOMO_SAPIENS",
      type: "SPECIES" as const,
      name: "Homo sapiens",
      isOfficial: true,
      parent: {
        taxonomyLevelId: "TAX_GENUS_HOMO",
        type: "GENUS" as const,
        name: "Homo",
        isOfficial: true,
        parent: { taxonomyLevelId: "TAX_FAMILY_HOMINIDAE", type: "FAMILY" as const, name: "Hominidae", isOfficial: true },
      },
    };
    expect(validateTaxonomy(taxonomy)).toEqual([]);
    expect(validateTaxonomy({ ...taxonomy, parent: { ...taxonomy.parent, type: "ORDER" as const } })).toContain("Taxonomy parent of SPECIES must be GENUS.");
    expect(validateTaxonomy({ ...taxonomy, name: " " })).toContain("Taxonomy name cannot be blank.");
    expect(validateTaxonomy({ ...taxonomy, taxonomyLevelId: "species" })).toContain("Taxonomy SPECIES Homo sapiens must use taxonomyLevelId TAX_SPECIES_HOMO_SAPIENS.");
    expect(validateTaxonomy({ ...taxonomy, isOfficial: "yes" })).toContain("Taxonomy isOfficial must be boolean.");
    const cyclic: Record<string, unknown> = { taxonomyLevelId: "TAX_SPECIES_CYCLE", type: "SPECIES", name: "Cycle", isOfficial: false };
    cyclic.parent = cyclic;
    expect(validateTaxonomy(cyclic)).toContain("Taxonomy cannot contain cycles.");
  });

  it("resolves each presentation scalar independently by first nonblank value", () => {
    expect(resolvePresentation(
      { accent: "species accent", appearance: "species appearance", clothing: "species clothing", architecture: "species architecture" },
      { accent: "culture accent must not inherit", appearance: " culture appearance ", clothing: "", architecture: "culture architecture" },
      { accent: "breed accent", appearance: "   ", clothing: "breed clothing", architecture: null },
    )).toEqual({ accent: "breed accent", appearance: " culture appearance ", clothing: "breed clothing", architecture: "culture architecture" });
  });

  it("enforces the complete PET species presentation invariant", () => {
    const valid = { speciesId: "SPC_HOUSE_CAT", name: "House cat", speciesKind: "PET" as const, anthropomorphization: null, appearance: "A compact domestic cat with a flexible spine, triangular ears, whiskered muzzle, and species-accurate paws.", clothing: null, architecture: null };
    expect(validateSpecies(valid)).toEqual([]);
    expect(validateSpecies({ ...valid, anthropomorphization: "upright person", clothing: "coat", architecture: "stone halls" })).toEqual(expect.arrayContaining([
      "PET Species anthropomorphization must be null.",
      "PET Species clothing must be null.",
      "PET Species architecture must be null.",
    ]));
  });

  it("enforces group prefix, PET, personality, and controlled-array invariants", () => {
    const base = {
      speciesKind: "BEAST" as const,
      groupId: "B01" as const,
      cultureId: "CP01",
      personalityId: "KNOWN",
      foodBroad: ["ANIMAL"],
      foodSpecific: ["FISH"],
      terrainBroad: ["OCEAN"],
      terrainSpecific: ["PELAGIC"],
    };
    expect(validateBreed(base, { personalityIds: new Set(["KNOWN"]) })).toEqual([]);
    expect(validateBreed({ ...base, groupId: "H01" }, { personalityIds: new Set(["KNOWN"]) })).toContain("Breed group H01 belongs to HUMAN, not BEAST.");
    expect(validateBreed({ ...base, foodBroad: ["ANIMAL", "ANIMAL"] }, { personalityIds: new Set(["KNOWN"]) })).toContain("foodBroad cannot contain duplicates.");
    expect(validateBreed({ ...base, personalityId: "MISSING" }, { personalityIds: new Set(["KNOWN"]) })).toContain("PersonalityExpression MISSING does not exist.");
    expect(validateBreed({ ...base, speciesKind: "PET", groupId: "P01", cultureId: "CP01", personalityId: "KNOWN" }, { personalityIds: new Set(["KNOWN"]) })).toEqual(expect.arrayContaining(["PET breeds cannot have a Culture.", "PET breeds cannot have a PersonalityExpression."]));
  });

  it("derives all economic and political forms and returns null for incomplete raw inputs", () => {
    const economic = new Set<string>();
    for (const ownershipMode of ["SINGLE_ENTITY", "COMMON_USE", "SHARED_TITLE"] as const) {
      for (const allocationMode of ["CUSTOMARY", "MARKET", "PLANNED"] as const) economic.add(deriveEconomicForm({ ownershipMode, allocationMode })!);
    }
    expect(economic).toEqual(new Set(["TRIBUTARY_DEMESNE", "MONOPOLY_ESTATE", "COMMAND_DEMESNE", "FOLK_COMMONS", "OPEN_BAZAAR", "COMMUNE_PLAN", "GUILD_COMPACT", "SHAREHOLDER_BOURSE", "SYNDICATE_CARTEL"]));
    expect(deriveEconomicForm({ ownershipMode: null, allocationMode: "MARKET" })).toBeNull();

    const political = new Set<string>();
    for (const administrationMode of ["CENTRALIZED", "DELEGATED", "DISTRIBUTED"] as const) {
      for (const legitimacyBasis of ["ANCESTRAL", "CHARTERED", "MARTIAL"] as const) {
        for (const authoritySource of ["APPOINTMENT", "DIVINE_MANDATE", "ELECTION"] as const) political.add(derivePoliticalForm({ administrationMode, legitimacyBasis, authoritySource })!);
      }
    }
    expect(political).toHaveLength(27);
    expect(derivePoliticalForm({ administrationMode: "CENTRALIZED", legitimacyBasis: "ANCESTRAL", authoritySource: "ELECTION" })).toBe("ELECTIVE_CROWN");
    expect(derivePoliticalForm({ administrationMode: "CENTRALIZED", legitimacyBasis: null, authoritySource: "ELECTION" })).toBeNull();
  });
});
