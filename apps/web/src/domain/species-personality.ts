import { SpeciesResearchDimension, type SpeciesResearchDimension as SpeciesPersonalityDimension } from "../generated/prisma/enums";

export const speciesPersonalityDimensions = Object.values(SpeciesResearchDimension);

export function isSpeciesPersonalityDimension(value: string): value is SpeciesPersonalityDimension {
  return speciesPersonalityDimensions.includes(value as SpeciesPersonalityDimension);
}
