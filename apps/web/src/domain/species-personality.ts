export const speciesPersonalityDimensions = [
  "ADMINISTRATION_MODE",
  "STRUCTURE_ORIENTATION",
  "OPERATING_STYLE",
  "MOTIVATION",
  "AUTHORITY_SOURCE",
  "LEGITIMACY_BASIS",
  "ALLOCATION_MODE",
  "OWNERSHIP_MODE",
  "LOQUACITY",
  "EMOTIONAL_TEMPERATURE",
  "OUTLOOK_ORIENTATION",
  "COLLABORATIVE_POSTURE",
] as const;

export type SpeciesPersonalityDimension = (typeof speciesPersonalityDimensions)[number];

export function isSpeciesPersonalityDimension(value: string): value is SpeciesPersonalityDimension {
  return speciesPersonalityDimensions.includes(value as SpeciesPersonalityDimension);
}
