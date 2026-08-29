import { describe, expect, it } from "vitest";

import { buildArchitectWitnessCharacterCompletenessArtifact, canonicalCharacterPresentationFields } from "../../src/domain/architect-witness-completeness";

describe("Architect/Witness Character completeness artifact", () => {
  it("covers every canonical Character and every presentation field without silent omission", () => {
    const artifact = buildArchitectWitnessCharacterCompletenessArtifact();
    expect(artifact.counts).toMatchObject({ architects: 56, characters: 112, witnesses: 54, guideIdentities: 2, fieldEntries: 112 * canonicalCharacterPresentationFields.length, silentlyOmittedRecords: 0 });
    expect(new Set(artifact.records.map(({ characterId }) => characterId)).size).toBe(112);
    expect(artifact.records.every(({ fields }) => fields.length === canonicalCharacterPresentationFields.length)).toBe(true);
    expect(artifact.counts).toMatchObject({ recoveredArchitectPresentationFields: 224, recoveredWitnessGenderFields: 54, unresolvedDataPipelineLossFields: 0, unresolvedMissingButAuthoredFields: 0 });
    expect(artifact.counts).toMatchObject({ recoveredWitnessAgeFields: 54, witnessDemographicMismatches: 0 });
  });

  it("records exact unresolved Hammer facts and traced prompt provenance", () => {
    const artifact = buildArchitectWitnessCharacterCompletenessArtifact();
    const hammer = artifact.records.find(({ characterId }) => characterId === "CHA_WITNESS_OF_THE_HAMMER")!;
    expect(hammer.promptProvenance).toMatchObject({ sourceClass: "C", manualPromptIsAdditive: true, generatedOrInferredValuesMayNotBackfillCanonicalFields: true });
    expect(Object.fromEntries(hammer.fields.map(({ field, status, value }) => [field, { status, value }]))).toMatchObject({
      age: { status: "PRESENT_CANONICAL", value: "53" },
      gender: { status: "PRESENT_CANONICAL", value: "MALE" },
      skinScaleColor: { status: "AUTHORITY_NOT_FOUND", value: null },
      hairFurColor: { status: "AUTHORITY_NOT_FOUND", value: null },
      eyeColor: { status: "AUTHORITY_NOT_FOUND", value: null },
      clothing: { status: "AUTHORITY_NOT_FOUND", value: null },
    });
  });
});
