import { z } from "zod";

import rosterData from "../data/architect-witness-roster.json";
import { ArchitectDepartment } from "../generated/prisma/enums";
import { canonicalIdToken } from "./worldbuilding";

const identity = z.string().trim().min(1);
const transformationSchema = z.object({
  department: z.enum(ArchitectDepartment),
  architectName: identity,
  architectBreedId: identity,
  witnessName: identity,
  witnessBreedId: identity,
  kernel: z.enum(["PRESTIGE", "RIVALRY"]).optional(),
}).strict();

const rosterSchema = z.object({
  schemaVersion: z.literal("eidolon-architect-witness-roster-v1"),
  ordinaryTransformations: z.array(transformationSchema).length(54),
  presidingArchitects: z.tuple([
    z.object({ displayName: z.literal("Hans Halycon Hohenzollern"), breedId: identity, department: z.null(), guideForm: z.literal("The Overseer") }).strict(),
    z.object({ displayName: z.literal("Noell Pieter Smukk"), breedId: identity, department: z.null() }).strict(),
  ]),
  otherCharacters: z.tuple([
    z.object({ displayName: z.literal("Frank Adrian Voss"), breedId: identity, guideForm: z.literal("The Showman") }).strict(),
  ]),
  omittedIdentities: z.tuple([
    z.object({ displayName: z.literal("Mother"), reason: identity }).strict(),
  ]),
  compositePresentations: z.array(z.tuple([identity, identity])).length(3),
}).strict();

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

function validateRoster(value: unknown) {
  const roster = rosterSchema.parse(value);
  const departments = roster.ordinaryTransformations.map(({ department }) => department);
  const expectedDepartments = Object.values(ArchitectDepartment);
  if (new Set(departments).size !== 54 || expectedDepartments.some((department) => !departments.includes(department))) {
    throw new Error("Canonical roster must represent every ArchitectDepartment exactly once.");
  }
  const identities = roster.ordinaryTransformations.flatMap((row) => [
    canonicalCharacterId(row.architectName),
    canonicalCharacterId(row.witnessName),
  ]);
  if (new Set(identities).size !== identities.length) throw new Error("Canonical roster contains duplicate Character identities.");
  const witnessNames = new Set(roster.ordinaryTransformations.map(({ witnessName }) => witnessName));
  for (const pair of roster.compositePresentations) {
    if (!pair.every((name) => witnessNames.has(name)) || pair[0] === pair[1]) throw new Error("Composite Witness presentation must name two distinct canonical Witnesses.");
  }
  const sponsorship = roster.ordinaryTransformations.find(({ department }) => department === "SPONSORSHIP");
  const innovation = roster.ordinaryTransformations.find(({ department }) => department === "INNOVATION");
  if (sponsorship?.architectName !== "Daniyar Serikuly Beketov" || sponsorship.witnessName !== "The Witness of the Spotlight" || sponsorship.kernel !== "PRESTIGE") throw new Error("SPONSORSHIP canonical seat drifted.");
  if (innovation?.architectName !== "Temüülen Erdenebat Ganbold" || innovation.witnessName !== "The Witness of the Arena" || innovation.kernel !== "RIVALRY") throw new Error("INNOVATION canonical seat drifted.");
  return roster;
}

export const canonicalArchitectWitnessRoster = Object.freeze(validateRoster(rosterData));
export type CanonicalArchitectWitnessRoster = typeof canonicalArchitectWitnessRoster;
