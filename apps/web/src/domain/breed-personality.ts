import {
  BreedDimensionValue,
  BreedResearchDimension,
  type BreedDimensionValue as BreedPersonalityValue,
  type BreedResearchDimension as BreedPersonalityDimension,
} from "../generated/prisma/enums";

export const breedPersonalityDimensions = Object.values(BreedResearchDimension);
export const breedPersonalityValues = Object.values(BreedDimensionValue);

export function isBreedPersonalityDimension(value: string): value is BreedPersonalityDimension {
  return breedPersonalityDimensions.includes(value as BreedPersonalityDimension);
}

export function isBreedPersonalityValue(value: string): value is BreedPersonalityValue {
  return breedPersonalityValues.includes(value as BreedPersonalityValue);
}

export const breedPersonalityValuesByDimension = Object.freeze({
  ADMINISTRATION_MODE: ["CENTRALIZED", "DELEGATED", "DISTRIBUTED"],
  STRUCTURE_ORIENTATION: ["ORDERED", "NEUTRAL", "CHAOS"],
  OPERATING_STYLE: ["TEAMWORK", "SITUATIONAL", "SOLO"],
  MOTIVATION: ["ALTRUISTIC", "RECIPROCAL", "SELFISH"],
  AUTHORITY_SOURCE: ["APPOINTMENT", "DIVINE_MANDATE", "ELECTION"],
  LEGITIMACY_BASIS: ["ANCESTRAL", "CHARTERED", "MARTIAL"],
  ALLOCATION_MODE: ["CUSTOMARY", "MARKET", "PLANNED"],
  OWNERSHIP_MODE: ["COMMON_USE", "SHARED_TITLE", "SINGLE_ENTITY"],
  LOQUACITY: ["LIGHT_BANTER", "TALKATIVE", "TO_THE_POINT"],
  EMOTIONAL_TEMPERATURE: ["COMPOSED", "IRRITABLE", "JOYFUL"],
  OUTLOOK_ORIENTATION: ["NEUTRAL", "OPTIMISTIC", "PESSIMISTIC"],
  COLLABORATIVE_POSTURE: ["HELPFUL", "JUST_ENOUGH", "WITHHOLDING"],
} as const satisfies Record<BreedPersonalityDimension, readonly BreedPersonalityValue[]>);

export function isValueForBreedDimension(
  dimension: BreedPersonalityDimension,
  value: BreedPersonalityValue,
): boolean {
  return breedPersonalityValuesByDimension[dimension].includes(value as never);
}
