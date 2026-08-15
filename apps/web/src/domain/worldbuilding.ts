import breedGroups from "../data/breed-groups-v3.json";
import worldBuildingEnums from "../data/worldbuilding-enums-v3.json";

export type SpeciesKind = "BEAST" | "HUMAN" | "MYTHOS" | "PET";
export type TaxonomyType = "KINGDOM" | "PHYLUM" | "CLASS" | "ORDER" | "FAMILY" | "GENUS" | "SPECIES";
export interface Taxonomy {
  taxonomyLevelId: string;
  type: TaxonomyType;
  name: string;
  isOfficial: boolean;
  text?: string;
  commonName?: string;
  parent?: Taxonomy;
}

export const WORLD_BUILDING_ENUMS = Object.freeze(worldBuildingEnums);
export const BREED_GROUP_IDS = Object.freeze(breedGroups.map(({ groupId }) => groupId));
export type BreedGroupId = (typeof breedGroups)[number]["groupId"];
export const BREED_GROUPS = Object.freeze(Object.fromEntries(breedGroups.map((group) => [group.groupId, Object.freeze(group)]))) as Readonly<Record<BreedGroupId, Readonly<{ groupId: BreedGroupId; speciesKind: SpeciesKind; label: string }>>>;

const taxonomyOrder = ["KINGDOM", "PHYLUM", "CLASS", "ORDER", "FAMILY", "GENUS", "SPECIES"] as const;
const taxonomyTypes = new Set<string>(taxonomyOrder);

export type CanonicalWorldbuildingEntityKind = "SPECIES" | "CULTURE" | "BREED";

export function canonicalIdToken(name: string): string {
  return name
    .normalize("NFKD")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function canonicalEntityId(kind: CanonicalWorldbuildingEntityKind, finalizedCanonicalName: string): string {
  const token = canonicalIdToken(finalizedCanonicalName);
  if (!token) throw new Error(`${kind} canonical name must contain at least one letter or number.`);
  const prefix = kind === "SPECIES" ? "SPC" : kind === "CULTURE" ? "CLT" : "BRD";
  return `${prefix}_${token}`;
}

export function canonicalTaxonomyLevelId(type: TaxonomyType, finalizedCanonicalName: string): string {
  const token = canonicalIdToken(finalizedCanonicalName);
  if (!token) throw new Error(`${type} taxonomy name must contain at least one letter or number.`);
  return `TAX_${type}_${token}`;
}

export function validateTaxonomy(value: unknown): string[] {
  const errors: string[] = [];
  const visiting = new WeakSet<object>();
  const visitedIds = new Set<string>();
  const visit = (node: unknown): void => {
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      errors.push("Taxonomy must be an object.");
      return;
    }
    if (visiting.has(node)) {
      errors.push("Taxonomy cannot contain cycles.");
      return;
    }
    visiting.add(node);
    const record = node as Record<string, unknown>;
    if (typeof record.taxonomyLevelId !== "string" || !record.taxonomyLevelId.trim()) errors.push("Taxonomy taxonomyLevelId cannot be blank.");
    else if (visitedIds.has(record.taxonomyLevelId)) errors.push(`Taxonomy taxonomyLevelId ${record.taxonomyLevelId} is duplicated.`);
    else visitedIds.add(record.taxonomyLevelId);
    if (typeof record.name !== "string" || !record.name.trim()) errors.push("Taxonomy name cannot be blank.");
    if (typeof record.type !== "string" || !taxonomyTypes.has(record.type)) errors.push("Taxonomy type is invalid.");
    if (typeof record.isOfficial !== "boolean") errors.push("Taxonomy isOfficial must be boolean.");
    if (typeof record.type === "string" && taxonomyTypes.has(record.type) && typeof record.name === "string" && record.name.trim() && typeof record.taxonomyLevelId === "string") {
      const expectedId = canonicalTaxonomyLevelId(record.type as TaxonomyType, record.name);
      if (record.taxonomyLevelId !== expectedId) errors.push(`Taxonomy ${record.type} ${record.name} must use taxonomyLevelId ${expectedId}.`);
    }
    for (const field of ["text", "commonName"] as const) {
      if (record[field] !== undefined && (typeof record[field] !== "string" || !record[field].trim())) errors.push(`Taxonomy ${field} cannot be blank when supplied.`);
    }
    if (record.parent !== undefined) {
      if (typeof record.type === "string" && taxonomyTypes.has(record.type) && typeof record.parent === "object" && record.parent !== null) {
        const parentType = (record.parent as Record<string, unknown>).type;
        const index = taxonomyOrder.indexOf(record.type as TaxonomyType);
        const expected = index > 0 ? taxonomyOrder[index - 1] : undefined;
        if (parentType !== expected) errors.push(`Taxonomy parent of ${record.type} must be ${expected ?? "absent"}.`);
      }
      visit(record.parent);
    }
    visiting.delete(node);
  };
  visit(value);
  return [...new Set(errors)];
}

type Presentation = { accent?: string | null; appearance?: string | null; clothing?: string | null; architecture?: string | null };
const firstNonblank = (...values: Array<string | null | undefined>) => values.find((value) => typeof value === "string" && value.trim().length > 0);
export function resolvePresentation(species: Presentation, culture?: Presentation | null, breed?: Presentation | null): Presentation {
  return {
    accent: firstNonblank(breed?.accent, species.accent),
    appearance: firstNonblank(breed?.appearance, culture?.appearance, species.appearance),
    clothing: firstNonblank(breed?.clothing, culture?.clothing, species.clothing),
    architecture: firstNonblank(breed?.architecture, culture?.architecture, species.architecture),
  };
}

export type SpeciesValidationInput = {
  speciesId: string;
  name: string;
  speciesKind: SpeciesKind;
  anthropomorphization?: string | null;
  appearance?: string | null;
  clothing?: string | null;
  architecture?: string | null;
};

export function validateSpecies(input: SpeciesValidationInput): string[] {
  const errors: string[] = [];
  const expectedId = canonicalEntityId("SPECIES", input.name);
  if (input.speciesId !== expectedId) errors.push(`Species ${input.name} must use speciesId ${expectedId}.`);
  if (input.speciesKind === "PET") {
    if (input.anthropomorphization != null) errors.push("PET Species anthropomorphization must be null.");
    if (input.clothing != null) errors.push("PET Species clothing must be null.");
    if (input.architecture != null) errors.push("PET Species architecture must be null.");
    if (typeof input.appearance !== "string" || !input.appearance.trim()) errors.push("PET Species appearance must be biologically prompt-ready.");
  }
  return errors;
}

export const breedDimensionValues = Object.freeze(WORLD_BUILDING_ENUMS.BreedDimensions);
export type BreedValidationInput = {
  speciesKind: SpeciesKind;
  groupId: string;
  cultureId?: string | null;
  personalityId?: string | null;
  foodBroad: readonly string[];
  foodSpecific: readonly string[];
  terrainBroad: readonly string[];
  terrainSpecific: readonly string[];
  administrationMode?: string | null;
  structureOrientation?: string | null;
  operatingStyle?: string | null;
  motivation?: string | null;
  authoritySource?: string | null;
  legitimacyBasis?: string | null;
  allocationMode?: string | null;
  ownershipMode?: string | null;
  loquacity?: string | null;
  emotionalTemperature?: string | null;
  outlookOrientation?: string | null;
  collaborativePosture?: string | null;
};

export function validateBreed(input: BreedValidationInput, context: { personalityIds: ReadonlySet<string> }): string[] {
  const errors: string[] = [];
  const group = BREED_GROUPS[input.groupId as BreedGroupId];
  if (!group) errors.push(`Breed group ${input.groupId} is not registered.`);
  else if (group.speciesKind !== input.speciesKind) errors.push(`Breed group ${input.groupId} belongs to ${group.speciesKind}, not ${input.speciesKind}.`);
  if (input.speciesKind === "PET") {
    if (input.cultureId != null) errors.push("PET breeds cannot have a Culture.");
    if (input.personalityId != null) errors.push("PET breeds cannot have a PersonalityExpression.");
  } else if (!input.personalityId) {
    errors.push(`${input.speciesKind} breeds require a PersonalityExpression.`);
  } else if (!context.personalityIds.has(input.personalityId)) {
    errors.push(`PersonalityExpression ${input.personalityId} does not exist.`);
  }
  const arrays = [
    ["foodBroad", input.foodBroad, WORLD_BUILDING_ENUMS.FoodBroadCategory],
    ["foodSpecific", input.foodSpecific, WORLD_BUILDING_ENUMS.FoodSpecific],
    ["terrainBroad", input.terrainBroad, WORLD_BUILDING_ENUMS.TerrainBroad],
    ["terrainSpecific", input.terrainSpecific, WORLD_BUILDING_ENUMS.SpecificTerrain],
  ] as const;
  for (const [name, values, allowedValues] of arrays) {
    if (new Set(values).size !== values.length) errors.push(`${name} cannot contain duplicates.`);
    const allowed = new Set<string>(allowedValues);
    for (const value of values) if (!allowed.has(value)) errors.push(`${name} contains invalid value ${value}.`);
  }
  for (const [field, allowedValues] of Object.entries(breedDimensionValues)) {
    const value = input[field as keyof BreedValidationInput];
    if (value != null && !new Set<string>(allowedValues).has(String(value))) errors.push(`${field} contains invalid value ${String(value)}.`);
  }
  return errors;
}

type EconomicInput = { ownershipMode?: "SINGLE_ENTITY" | "COMMON_USE" | "SHARED_TITLE" | null; allocationMode?: "CUSTOMARY" | "MARKET" | "PLANNED" | null };
const economicForms = {
  SINGLE_ENTITY: { CUSTOMARY: "TRIBUTARY_DEMESNE", MARKET: "MONOPOLY_ESTATE", PLANNED: "COMMAND_DEMESNE" },
  COMMON_USE: { CUSTOMARY: "FOLK_COMMONS", MARKET: "OPEN_BAZAAR", PLANNED: "COMMUNE_PLAN" },
  SHARED_TITLE: { CUSTOMARY: "GUILD_COMPACT", MARKET: "SHAREHOLDER_BOURSE", PLANNED: "SYNDICATE_CARTEL" },
} as const;
export function deriveEconomicForm(input: EconomicInput): string | null {
  return input.ownershipMode && input.allocationMode ? economicForms[input.ownershipMode][input.allocationMode] : null;
}

type PoliticalInput = { administrationMode?: "CENTRALIZED" | "DELEGATED" | "DISTRIBUTED" | null; legitimacyBasis?: "ANCESTRAL" | "CHARTERED" | "MARTIAL" | null; authoritySource?: "APPOINTMENT" | "DIVINE_MANDATE" | "ELECTION" | null };
const politicalForms = {
  CENTRALIZED: {
    ANCESTRAL: { APPOINTMENT: "REGENT_THRONE", DIVINE_MANDATE: "DIVINE_THRONE", ELECTION: "ELECTIVE_CROWN" },
    CHARTERED: { APPOINTMENT: "APPOINTED_DIRECTORATE", DIVINE_MANDATE: "COVENANT_CROWN", ELECTION: "ELECTED_EXECUTIVE" },
    MARTIAL: { APPOINTMENT: "JUNTA", DIVINE_MANDATE: "MILITANT_THEOCRACY", ELECTION: "ACCLAIMED_IMPERATOR" },
  },
  DELEGATED: {
    ANCESTRAL: { APPOINTMENT: "FEUDAL_ORDER", DIVINE_MANDATE: "TEMPLE_HIERARCHY", ELECTION: "ESTATES_DIET" },
    CHARTERED: { APPOINTMENT: "APPOINTED_COMMISSION", DIVINE_MANDATE: "CONSECRATED_REPUBLIC", ELECTION: "REPUBLIC" },
    MARTIAL: { APPOINTMENT: "GARRISON_COMMAND", DIVINE_MANDATE: "MILITANT_ORDER", ELECTION: "CAPTAINS_COUNCIL" },
  },
  DISTRIBUTED: {
    ANCESTRAL: { APPOINTMENT: "ELDER_MOOT", DIVINE_MANDATE: "HALLOWED_CUSTOM", ELECTION: "CHIEFTAIN_COUNCIL" },
    CHARTERED: { APPOINTMENT: "DELEGATE_LEAGUE", DIVINE_MANDATE: "COVENANT_ASSEMBLY", ELECTION: "POPULAR_FEDERATION" },
    MARTIAL: { APPOINTMENT: "RAIDER_CONFEDERACY", DIVINE_MANDATE: "ZEALOT_BANDS", ELECTION: "FREE_COMPANY" },
  },
} as const;
export function derivePoliticalForm(input: PoliticalInput): string | null {
  return input.administrationMode && input.legitimacyBasis && input.authoritySource
    ? politicalForms[input.administrationMode][input.legitimacyBasis][input.authoritySource]
    : null;
}
