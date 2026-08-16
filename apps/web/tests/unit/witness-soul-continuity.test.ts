import { describe, expect, it } from "vitest";

import {
  assertDistinctWitnessSoulChains,
  assertWitnessArchitectSoulContinuity,
} from "../../src/domain/invariants";

describe("Architect to Witness Soul continuity", () => {
  it("accepts distinct Characters that preserve one non-null Soul", () => {
    expect(() => assertWitnessArchitectSoulContinuity(
      { characterId: "CHA_WITNESS", soulId: "SOUL_1" },
      { characterId: "CHA_ARCHITECT", soulId: "SOUL_1" },
    )).not.toThrow();
  });

  it.each([
    ["SOUL_2", "SOUL_1"],
    [null, "SOUL_1"],
    ["SOUL_1", null],
  ])("rejects mismatched or null Souls", (witnessSoulId, architectSoulId) => {
    expect(() => assertWitnessArchitectSoulContinuity(
      { characterId: "CHA_WITNESS", soulId: witnessSoulId },
      { characterId: "CHA_ARCHITECT", soulId: architectSoulId },
    )).toThrow("Witness and source Architect must reference the same Soul.");
  });

  it("accepts paired presentation components with two independent Soul chains", () => {
    expect(() => assertDistinctWitnessSoulChains([
      { architect: { characterId: "CHA_SEAL_ARCHITECT", soulId: "SOUL_SEAL" }, witness: { characterId: "CHA_WITNESS_OF_THE_SEAL", soulId: "SOUL_SEAL" } },
      { architect: { characterId: "CHA_HARNESS_ARCHITECT", soulId: "SOUL_HARNESS" }, witness: { characterId: "CHA_WITNESS_OF_THE_HARNESS", soulId: "SOUL_HARNESS" } },
    ])).not.toThrow();
  });

  it("rejects paired components collapsed onto one Soul", () => {
    expect(() => assertDistinctWitnessSoulChains([
      { architect: { characterId: "CHA_SEAL_ARCHITECT", soulId: "SOUL_SEAL" }, witness: { characterId: "CHA_WITNESS_OF_THE_SEAL", soulId: "SOUL_SEAL" } },
      { architect: { characterId: "CHA_HARNESS_ARCHITECT", soulId: "SOUL_HARNESS" }, witness: { characterId: "CHA_WITNESS_OF_THE_HARNESS", soulId: "SOUL_SEAL" } },
    ])).toThrow("Witness and source Architect must reference the same Soul.");
  });
});
