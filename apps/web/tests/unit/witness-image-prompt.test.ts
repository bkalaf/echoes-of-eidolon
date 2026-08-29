import { describe, expect, it, vi } from "vitest";

import { composeWitnessImagePrompt, WitnessPromptCanonicalDataError } from "../../src/server/witness-image-prompt";

const hammer = {
  architect: { department: "JUSTICE", character: { displayName: "Andrei Mihai Popescu", soul: { name: "Andrei Mihai Popescu" } } },
  character: {
    displayName: "The Witness of the Hammer", worldKey: "RUIN", gender: "MALE", age: null,
    skinScaleColor: null, hairFurColor: null, eyeColor: null, clothing: null,
    breed: { name: "Minotaur", species: { name: "Minotaur" }, culture: null }, occupation: null, soul: { name: "Andrei Mihai Popescu" },
  },
  witnessDef: { name: "The Witness of the Hammer", department: "JUSTICE", apparentDomain: "Restitution", realDomain: "Retaliation", color: { WHITE: 100 } },
  trueFlawName: "Retaliation",
};

describe("canonical Witness image prompt composition", () => {
  it("injects persisted semantic context ahead of additive manual prose", async () => {
    const database = { witness: { findUnique: vi.fn().mockResolvedValue(hammer) } };
    const prompt = await composeWitnessImagePrompt("CHA_WITNESS_OF_THE_HAMMER", "Ceremonial hammer and justice imagery.", ["gender"], database as never);
    expect(prompt.indexOf("CANONICAL WITNESS CONTEXT")).toBeLessThan(prompt.indexOf("OWNER-AUTHORED ADDITIVE PROMPT"));
    expect(prompt).toContain('"name": "Minotaur"');
    expect(prompt).toContain('"name": "Andrei Mihai Popescu"');
    expect(prompt).toContain('"world": "RUIN"');
  });

  it("fails when a prompt requires an absent canonical visual field", async () => {
    const database = { witness: { findUnique: vi.fn().mockResolvedValue(hammer) } };
    await expect(composeWitnessImagePrompt("CHA_WITNESS_OF_THE_HAMMER", "Must show green eyes.", ["eyeColor"], database as never)).rejects.toThrow(WitnessPromptCanonicalDataError);
  });
});
