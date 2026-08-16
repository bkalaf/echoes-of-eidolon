import { z } from "zod";

import architectsData from "../data/architect-witness-guide/architects.json";
import guidesData from "../data/architect-witness-guide/guides.json";
import soulsData from "../data/architect-witness-guide/souls.json";
import witnessDefsData from "../data/architect-witness-guide/witness_defs.json";
import witnessesData from "../data/architect-witness-guide/witnesses.json";
import { ArchitectDepartment, WorldKey } from "../generated/prisma/enums";
import { canonicalIdToken } from "./worldbuilding";

const identity = z.string().trim().min(1);
export const WITNESS_DEF_ID_PREFIX = "WDF" as const;
export const witnessDefIdSchema = identity.regex(/^WDF_[A-Z0-9]+(?:_[A-Z0-9]+)*$/);
const characterSchema = z.object({
  characterId: identity.regex(/^CHA_[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
  displayName: identity,
  breedId: identity.regex(/^BRD_[A-Z0-9]+(?:_[A-Z0-9]+)*$/).nullable(),
  soulId: identity.regex(/^SOUL_[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
  worldKey: z.enum(WorldKey).nullable(),
  age: identity.nullable(),
  gender: identity.nullable(),
}).strict();

const soulSchema = z.object({
  soulId: identity.regex(/^SOUL_[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
  name: identity,
  purpose: identity,
}).strict();

const architectRowSchema = z.object({
  character: characterSchema,
  architect: z.object({
    characterId: identity,
    department: z.enum(ArchitectDepartment).nullable(),
  }).strict(),
}).strict();

const witnessDefinitionSchema = z.object({
  witnessDefId: witnessDefIdSchema,
  name: identity,
  department: z.enum(ArchitectDepartment),
  kernelKey: identity,
  apparentDomain: identity,
  realDomain: identity,
  color: z.object({
    SPECTRAL_VIOLET: z.number().min(0).max(100),
    GREEN: z.number().min(0).max(100),
    WHITE: z.number().min(0).max(100),
  }).strict(),
  architectSoulId: identity,
  worldKey: z.enum(WorldKey),
  bookNumber: z.number().int().positive(),
}).strict().superRefine((definition, context) => {
  const total = Object.values(definition.color).reduce((sum, percentage) => sum + percentage, 0);
  if (Math.abs(total - 100) > 0.000001) context.addIssue({ code: "custom", message: "WitnessDef color percentages must total 100." });
});

const witnessRowSchema = z.object({
  character: characterSchema,
  witness: z.object({
    characterId: identity,
    witnessDefId: identity,
    architectCharacterId: identity,
    trueFlawName: identity.nullable(),
    legendaryRewardId: identity.nullable(),
    constellationBeforeId: identity.nullable(),
    constellationAfterId: identity.nullable(),
  }).strict(),
  bookNumber: z.number().int().positive(),
}).strict();

const guideCharacterSchema = characterSchema.extend({
  identityKind: z.enum(["HUMAN", "AI"]),
  breedPolicy: identity.optional(),
}).strict();
const guideSchema = z.object({
  worldKey: z.enum(WorldKey),
  title: identity,
  underlyingDisplayName: identity,
  characterId: identity,
  soulId: identity,
  form: identity,
  createsAdditionalCharacter: z.literal(false),
}).strict();

const parsed = {
  souls: z.object({ schemaVersion: z.literal("eidolon-souls-v2"), rows: z.array(soulSchema).length(58) }).strict().parse(soulsData).rows,
  architects: z.object({ schemaVersion: z.literal("eidolon-architects-v2"), rows: z.array(architectRowSchema).length(56) }).strict().parse(architectsData).rows,
  witnessDefs: z.object({ schemaVersion: z.literal("eidolon-witness-defs-v2"), rows: z.array(witnessDefinitionSchema).length(54) }).strict().parse(witnessDefsData).rows,
  witnesses: z.object({ schemaVersion: z.literal("eidolon-witnesses-v2"), rows: z.array(witnessRowSchema).length(54) }).strict().parse(witnessesData).rows,
  guides: z.object({
    schemaVersion: z.literal("eidolon-guide-identity-v1"),
    charactersToEnsure: z.array(guideCharacterSchema).length(2),
    guides: z.array(guideSchema).length(3),
  }).strict().parse(guidesData),
};

const canonicalNonBiologicalCharacterIdSet = new Set(
  parsed.guides.charactersToEnsure
    .filter(({ identityKind }) => identityKind === "AI")
    .map(({ characterId }) => characterId),
);

export const canonicalNonBiologicalCharacterIds = Object.freeze([...canonicalNonBiologicalCharacterIdSet].sort());

export function assertCanonicalCharacterBreedPolicy(character: { characterId: string; breedId?: string | null }): void {
  const isAuthorizedNonBiologicalIdentity = canonicalNonBiologicalCharacterIdSet.has(character.characterId);
  if (isAuthorizedNonBiologicalIdentity) {
    if (character.breedId !== null) throw new Error(`Canonical non-biological Character ${character.characterId} must have breedId null.`);
    return;
  }
  if (typeof character.breedId !== "string" || !character.breedId.trim()) {
    throw new Error(`Breed is required for biological/worldbuilding Character ${character.characterId}.`);
  }
}

const compositePresentations = [
  ["The Witness of the Seal", "The Witness of the Harness"],
  ["The Witness of the Ring", "The Witness of the Mantle"],
  ["The Witness of the Loom", "The Witness of Patchwork"],
] as const;

export function canonicalCharacterId(displayName: string): string {
  const canonicalName = displayName.replace(/^The Witness\b/, "Witness");
  const token = canonicalIdToken(canonicalName);
  if (!token) throw new Error("Character canonical name must contain a letter or number.");
  return `CHA_${token}`;
}

export function canonicalSoulId(displayName: string): string {
  const token = canonicalIdToken(displayName);
  if (!token) throw new Error("Soul canonical name must contain a letter or number.");
  return `SOUL_${token}`;
}

function requireUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`Canonical input contains duplicate ${label}.`);
}

function validateCanonicalInput(): void {
  requireUnique(parsed.souls.map(({ soulId }) => soulId), "Soul IDs");
  requireUnique(parsed.architects.map(({ character }) => character.characterId), "Architect Character IDs");
  requireUnique(parsed.witnesses.map(({ character }) => character.characterId), "Witness Character IDs");
  requireUnique(parsed.witnessDefs.map(({ witnessDefId }) => witnessDefId), "WitnessDef IDs");

  const souls = new Set(parsed.souls.map(({ soulId }) => soulId));
  const architectById = new Map(parsed.architects.map((row) => [row.character.characterId, row]));
  const definitionById = new Map(parsed.witnessDefs.map((row) => [row.witnessDefId, row]));
  const departmentArchitects = parsed.architects.filter(({ architect }) => architect.department !== null);
  const departments = departmentArchitects.map(({ architect }) => architect.department!);
  const expectedDepartments = Object.values(ArchitectDepartment);
  if (new Set(departments).size !== 54 || expectedDepartments.some((department) => !departments.includes(department))) {
    throw new Error("Canonical input must represent every ArchitectDepartment exactly once.");
  }
  const presiding = parsed.architects.filter(({ architect }) => architect.department === null).map(({ character }) => character.characterId).sort();
  if (presiding.join(",") !== ["CHA_HANS_HALYCON_HOHENZOLLERN", "CHA_NOELL_PIETER_SMUKK"].sort().join(",")) {
    throw new Error("Only Hans and Noell may be presiding Architects without departments.");
  }

  for (const architect of parsed.architects) {
    assertCanonicalCharacterBreedPolicy(architect.character);
    if (architect.character.characterId !== architect.architect.characterId) throw new Error("Architect subtype ID must equal its Character ID.");
    if (!souls.has(architect.character.soulId)) throw new Error(`Architect ${architect.character.characterId} references an unknown Soul.`);
  }
  for (const row of parsed.witnesses) {
    assertCanonicalCharacterBreedPolicy(row.character);
    const source = architectById.get(row.witness.architectCharacterId);
    const definition = definitionById.get(row.witness.witnessDefId);
    if (row.character.characterId !== row.witness.characterId) throw new Error("Witness subtype ID must equal its Character ID.");
    if (!source || source.architect.department === null) throw new Error(`Witness ${row.character.characterId} must reference a department-seat Architect.`);
    if (!definition || definition.department !== source.architect.department) throw new Error(`Witness ${row.character.characterId} has a mismatched definition.`);
    if (row.character.soulId !== source.character.soulId || definition.architectSoulId !== source.character.soulId) {
      throw new Error(`Witness ${row.character.characterId}, its source Architect, and its WitnessDef must reference the same Soul.`);
    }
    if (row.character.characterId === source.character.characterId) throw new Error("Architect and Witness must remain distinct Characters.");
  }
  for (const character of parsed.guides.charactersToEnsure) assertCanonicalCharacterBreedPolicy(character);
  for (const definition of parsed.witnessDefs) {
    if (!souls.has(definition.architectSoulId)) throw new Error(`WitnessDef ${definition.witnessDefId} references an unknown Architect Soul.`);
  }
  const knownCharacterIds = new Set([
    ...parsed.architects.map(({ character }) => character.characterId),
    ...parsed.witnesses.map(({ character }) => character.characterId),
    ...parsed.guides.charactersToEnsure.map(({ characterId }) => characterId),
  ]);
  for (const guide of parsed.guides.guides) {
    if (!knownCharacterIds.has(guide.characterId) || !souls.has(guide.soulId)) throw new Error(`Guide ${guide.title} does not resolve an existing Character and Soul.`);
  }
}

validateCanonicalInput();

const guideByCharacterId = new Map(parsed.guides.guides.map((guide) => [guide.characterId, guide]));
const witnessDefinitionById = new Map(parsed.witnessDefs.map((definition) => [definition.witnessDefId, definition]));
const ordinaryTransformations = parsed.witnesses.map((witness) => {
  const architect = parsed.architects.find(({ character }) => character.characterId === witness.witness.architectCharacterId)!;
  const definition = witnessDefinitionById.get(witness.witness.witnessDefId)!;
  return Object.freeze({
    department: architect.architect.department!,
    architectName: architect.character.displayName,
    architectBreedId: architect.character.breedId!,
    witnessName: witness.character.displayName,
    witnessBreedId: witness.character.breedId!,
    kernel: definition.kernelKey,
  });
});

const presidingArchitects = parsed.architects.filter(({ architect }) => architect.department === null).map(({ character }) => Object.freeze({
  displayName: character.displayName,
  breedId: character.breedId!,
  department: null,
  guideForm: guideByCharacterId.get(character.characterId)?.title,
}));

const otherCharacters = parsed.guides.charactersToEnsure.map((character) => Object.freeze({
  displayName: character.displayName,
  breedId: character.breedId,
  guideForm: guideByCharacterId.get(character.characterId)?.title,
  identityKind: character.identityKind,
}));

export const canonicalArchitectWitnessGuideData = Object.freeze(parsed);
export const canonicalArchitectWitnessRoster = Object.freeze({
  schemaVersion: "eidolon-architect-witness-guide-canonical-v2" as const,
  ordinaryTransformations: Object.freeze(ordinaryTransformations),
  presidingArchitects: Object.freeze(presidingArchitects),
  otherCharacters: Object.freeze(otherCharacters),
  omittedIdentities: Object.freeze([]),
  compositePresentations,
});
export type CanonicalArchitectWitnessRoster = typeof canonicalArchitectWitnessRoster;
