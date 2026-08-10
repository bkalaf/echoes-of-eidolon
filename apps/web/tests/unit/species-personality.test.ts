import { describe, expect, it } from "vitest";

import { isSpeciesPersonalityDimension, speciesPersonalityDimensions } from "../../src/domain/species-personality";

describe("Species personality dimensions", () => {
  it("locks exactly the twelve supplied raw dimension keys", () => {
    expect(speciesPersonalityDimensions).toHaveLength(12);
    expect(new Set(speciesPersonalityDimensions).size).toBe(12);
    expect(speciesPersonalityDimensions).toEqual([
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
    ]);
    expect(isSpeciesPersonalityDimension("COLLABORATIVE_POSTURE")).toBe(true);
    expect(isSpeciesPersonalityDimension("INVENTED_DIMENSION")).toBe(false);
  });
});
