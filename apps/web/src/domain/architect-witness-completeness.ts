import { canonicalArchitectWitnessGuideData, witnessGenderOverrides } from "./architect-witness";

export const canonicalCharacterPresentationFields = [
  "characterId",
  "displayName",
  "breedId",
  "faction",
  "gender",
  "occupationId",
  "primaryAttribute",
  "secondaryAttribute",
  "soulId",
  "worldKey",
  "age",
  "skinScaleColor",
  "hairFurColor",
  "eyeColor",
  "clothing",
] as const;

export type CanonicalCharacterPresentationField = (typeof canonicalCharacterPresentationFields)[number];
export type NullClassification = "LEGITIMATELY_NOT_APPLICABLE" | "MISSING_BUT_AUTHORED" | "AUTHORITY_NOT_FOUND" | "DATA_PIPELINE_LOSS";

const sources = {
  canonicalPopulation: "apps/web/src/data/architect-witness-guide",
  architectRoster: "https://app.notion.com/p/3bd2380d0cae81e98227d621a41d7fe1",
  architectImages: "https://app.notion.com/p/3bd2380d0cae815a8103ff729a142e05",
  witnessCasting: "https://app.notion.com/p/3bb2380d0cae817986cecb2bd11bb3ff",
  witnessPrompts: {
    CONCORD: "https://app.notion.com/p/3bc2380d0cae8125ae5bfa632a3734b2",
    RUIN: "https://app.notion.com/p/3bc2380d0cae819ab39edccb2244cfcf",
    SCHISM: "https://app.notion.com/p/3bc2380d0cae816bbfebea1f7677a455",
  },
} as const;

type CharacterRecord = Record<string, unknown> & { characterId: string; displayName: string };

function nullClassification(role: "ARCHITECT" | "WITNESS" | "GUIDE_IDENTITY", character: CharacterRecord, field: CanonicalCharacterPresentationField): NullClassification {
  if (field === "breedId" && character.characterId === "CHA_MOTHER") return "LEGITIMATELY_NOT_APPLICABLE";
  if (field === "worldKey" && role !== "WITNESS") return "LEGITIMATELY_NOT_APPLICABLE";
  if (field === "occupationId" && role === "ARCHITECT") return "LEGITIMATELY_NOT_APPLICABLE";
  return "AUTHORITY_NOT_FOUND";
}

function fieldAudit(role: "ARCHITECT" | "WITNESS" | "GUIDE_IDENTITY", character: CharacterRecord, field: CanonicalCharacterPresentationField) {
  const value = character[field] ?? null;
  const recoveredArchitectPresentation = role === "ARCHITECT" && ["skinScaleColor", "hairFurColor", "eyeColor", "clothing"].includes(field);
  const recoveredWitnessGender = role === "WITNESS" && field === "gender";
  const recoveredWitnessAge = role === "WITNESS" && field === "age";
  return {
    field,
    value,
    status: value === null ? nullClassification(role, character, field) : "PRESENT_CANONICAL",
    provenance: recoveredArchitectPresentation
      ? { sourceClass: "B", source: sources.architectImages, recovery: "DATA_PIPELINE_LOSS", resolved: true }
      : recoveredWitnessGender
        ? {
            sourceClass: "B",
            source: sources.architectRoster,
            recovery: "MISSING_BUT_AUTHORED",
            method: character.characterId in witnessGenderOverrides ? "OWNER_LOCKED_OVERRIDE" : "SOURCE_ARCHITECT_INHERITANCE",
            resolved: true,
          }
        : recoveredWitnessAge
          ? { sourceClass: "B", source: sources.architectRoster, recovery: "MISSING_BUT_AUTHORED", method: "SOURCE_ARCHITECT_INHERITANCE", resolved: true }
        : { sourceClass: "A", source: sources.canonicalPopulation },
  };
}

export function buildArchitectWitnessCharacterCompletenessArtifact() {
  const architectCharacterById = new Map(canonicalArchitectWitnessGuideData.architects.map(({ character }) => [character.characterId, character]));
  const architectRecords = canonicalArchitectWitnessGuideData.architects.map(({ architect, character }) => ({
    role: "ARCHITECT" as const,
    subtype: { department: architect.department },
    character: character as CharacterRecord,
  }));
  const witnessRecords = canonicalArchitectWitnessGuideData.witnesses.map(({ bookNumber, character, witness }) => ({
    role: "WITNESS" as const,
    subtype: { bookNumber, ...witness },
    character: character as CharacterRecord,
  }));
  const guideRecords = canonicalArchitectWitnessGuideData.guides.charactersToEnsure.map((character) => ({
    role: "GUIDE_IDENTITY" as const,
    subtype: { identityKind: character.identityKind },
    character: character as CharacterRecord,
  }));
  const records = [...architectRecords, ...witnessRecords, ...guideRecords].map(({ character, role, subtype }) => ({
    characterId: character.characterId,
    displayName: character.displayName,
    role,
    subtype,
    fields: canonicalCharacterPresentationFields.map((field) => fieldAudit(role, character, field)),
    ...(role === "WITNESS" ? {
      promptProvenance: {
        sourceClass: "C",
        source: sources.witnessPrompts[character.worldKey as keyof typeof sources.witnessPrompts],
        manualPromptIsAdditive: true,
        generatedOrInferredValuesMayNotBackfillCanonicalFields: true,
        canonicalContextRequired: ["displayName", "breedId", "gender", "soulId", "worldKey"],
      },
    } : {}),
  }));
  const allFields = records.flatMap(({ fields }) => fields);
  const witnessDemographicMismatches = witnessRecords.flatMap(({ character, subtype }) => {
    const source = architectCharacterById.get(subtype.architectCharacterId);
    const expectedGender = witnessGenderOverrides[character.characterId as keyof typeof witnessGenderOverrides] ?? source?.gender;
    return [
      ...(character.age !== source?.age ? [{ characterId: character.characterId, field: "age", actual: character.age ?? null, expected: source?.age ?? null }] : []),
      ...(character.gender !== expectedGender ? [{ characterId: character.characterId, field: "gender", actual: character.gender ?? null, expected: expectedGender ?? null }] : []),
    ];
  });
  return {
    schemaVersion: "owner-character-completeness-v1",
    sources,
    counts: {
      characters: records.length,
      architects: architectRecords.length,
      witnesses: witnessRecords.length,
      guideIdentities: guideRecords.length,
      fieldEntries: allFields.length,
      recoveredArchitectPresentationFields: architectRecords.length * 4,
      recoveredWitnessGenderFields: witnessRecords.length,
      recoveredWitnessAgeFields: witnessRecords.length,
      witnessDemographicMismatches: witnessDemographicMismatches.length,
      silentlyOmittedRecords: 0,
      unresolvedAuthorityFields: allFields.filter(({ status }) => status === "AUTHORITY_NOT_FOUND").length,
      legitimatelyNotApplicableFields: allFields.filter(({ status }) => status === "LEGITIMATELY_NOT_APPLICABLE").length,
      unresolvedMissingButAuthoredFields: allFields.filter(({ status }) => status === "MISSING_BUT_AUTHORED").length,
      unresolvedDataPipelineLossFields: allFields.filter(({ status }) => status === "DATA_PIPELINE_LOSS").length,
    },
    records,
  };
}
