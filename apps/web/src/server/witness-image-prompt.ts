import type { PrismaClient } from "../generated/prisma/client";

export const witnessCanonicalVisualFields = ["age", "gender", "skinScaleColor", "hairFurColor", "eyeColor", "clothing"] as const;
export type WitnessCanonicalVisualField = (typeof witnessCanonicalVisualFields)[number];

type WitnessPromptDatabase = Pick<PrismaClient, "witness">;

export class WitnessPromptCanonicalDataError extends Error {
  override name = "WitnessPromptCanonicalDataError";
}

export async function composeWitnessImagePrompt(
  witnessCharacterId: string,
  manualPrompt: string,
  requiredVisualFields: WitnessCanonicalVisualField[],
  database: WitnessPromptDatabase,
): Promise<string> {
  const record = await database.witness.findUnique({
    where: { characterId: witnessCharacterId },
    include: {
      architect: { include: { character: { include: { soul: true } } } },
      character: { include: { breed: { include: { culture: true, species: true } }, occupation: true, soul: true } },
      witnessDef: true,
    },
  });
  if (!record) throw new WitnessPromptCanonicalDataError(`Witness ${witnessCharacterId} does not exist.`);
  const missing = requiredVisualFields.filter((field) => record.character[field] == null || record.character[field] === "");
  if (missing.length) throw new WitnessPromptCanonicalDataError(`Witness image prompt requires missing canonical Character fields: ${missing.join(", ")}.`);
  const canonicalContext = {
    witness: {
      name: record.character.displayName,
      world: record.character.worldKey,
      gender: record.character.gender,
      age: record.character.age,
      appearance: {
        skinScaleColor: record.character.skinScaleColor,
        hairFurColor: record.character.hairFurColor,
        eyeColor: record.character.eyeColor,
        clothing: record.character.clothing,
      },
      breed: record.character.breed ? {
        name: record.character.breed.name,
        species: record.character.breed.species?.name ?? null,
        culture: record.character.breed.culture?.name ?? null,
      } : null,
      occupation: record.character.occupation?.name ?? null,
      soul: record.character.soul?.name ?? null,
    },
    definition: {
      name: record.witnessDef.name,
      department: record.witnessDef.department,
      apparentDomain: record.witnessDef.apparentDomain,
      realDomain: record.witnessDef.realDomain,
      color: record.witnessDef.color,
    },
    sourceArchitect: {
      name: record.architect.character.displayName,
      soul: record.architect.character.soul?.name ?? null,
      department: record.architect.department,
    },
    trueFlaw: record.trueFlawName,
  };
  return [
    "CANONICAL WITNESS CONTEXT — use these persisted facts; do not replace them with inferred shadow data:",
    JSON.stringify(canonicalContext, null, 2),
    "OWNER-AUTHORED ADDITIVE PROMPT:",
    manualPrompt.trim(),
  ].join("\n\n");
}
