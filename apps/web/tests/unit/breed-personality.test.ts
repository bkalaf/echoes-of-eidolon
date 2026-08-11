import { describe, expect, it } from "vitest";

import {
  breedPersonalityDimensions,
  breedPersonalityValuesByDimension,
  isBreedPersonalityDimension,
  isValueForBreedDimension,
} from "../../src/domain/breed-personality";

describe("Breed personality dimensions", () => {
  it("locks exactly twelve Breed-owned dimensions with three controlled values each", () => {
    expect(breedPersonalityDimensions).toEqual([
      "ADMINISTRATION_MODE", "STRUCTURE_ORIENTATION", "OPERATING_STYLE", "MOTIVATION",
      "AUTHORITY_SOURCE", "LEGITIMACY_BASIS", "ALLOCATION_MODE", "OWNERSHIP_MODE",
      "LOQUACITY", "EMOTIONAL_TEMPERATURE", "OUTLOOK_ORIENTATION", "COLLABORATIVE_POSTURE",
    ]);
    expect(Object.values(breedPersonalityValuesByDimension).every((values) => values.length === 3)).toBe(true);
    expect(isBreedPersonalityDimension("COLLABORATIVE_POSTURE")).toBe(true);
    expect(isBreedPersonalityDimension("INVENTED_DIMENSION")).toBe(false);
    expect(isValueForBreedDimension("LOQUACITY", "TALKATIVE")).toBe(true);
    expect(isValueForBreedDimension("LOQUACITY", "JOYFUL")).toBe(false);
  });
});
