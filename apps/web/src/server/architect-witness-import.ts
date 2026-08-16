import { assertCanonicalCharacterBreedPolicy, canonicalArchitectWitnessGuideData, canonicalArchitectWitnessRoster, canonicalNonBiologicalCharacterIds } from "../domain/architect-witness";
import { assertDistinctWitnessSoulChains, assertWitnessArchitectSoulContinuity } from "../domain/invariants";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import type { ArchitectDepartment } from "../generated/prisma/enums";

type Transaction = Prisma.TransactionClient;
type Counter = { created: number; unchanged: number };

const presidingIds = new Set(["CHA_HANS_HALYCON_HOHENZOLLERN", "CHA_NOELL_PIETER_SMUKK"]);

export class ArchitectWitnessPopulationError extends Error {
  override name = "ArchitectWitnessPopulationError";
}

function continuityError(input: {
  architectCharacterId: string;
  architectSoulId: string | null;
  witnessCharacterId: string;
  witnessSoulId: string | null;
  witnessDefId?: string;
  witnessDefSoulId?: string | null;
}): ArchitectWitnessPopulationError {
  return new ArchitectWitnessPopulationError(
    `Witness and source Architect must reference the same Soul. WitnessDef must reference that Soul. witnessCharacterId=${input.witnessCharacterId} architectCharacterId=${input.architectCharacterId} witnessSoulId=${input.witnessSoulId ?? "null"} architectSoulId=${input.architectSoulId ?? "null"} witnessDefId=${input.witnessDefId ?? "not-checked"} witnessDefSoulId=${input.witnessDefSoulId ?? "not-checked"}`,
  );
}

export async function assertPersistedWitnessArchitectSoulContinuity(
  database: Pick<Transaction, "architect" | "character" | "witnessDef">,
  input: { architectCharacterId: string; witnessCharacterId: string; witnessDefId?: string; proposedWitnessSoulId?: string | null },
): Promise<void> {
  if (presidingIds.has(input.architectCharacterId)) throw new ArchitectWitnessPopulationError("Hans and Noell cannot be ordinary concrete Witness sources.");
  const [architect, witnessCharacter, witnessDef] = await Promise.all([
    database.architect.findUnique({
      include: { character: { select: { characterId: true, soulId: true } } },
      where: { characterId: input.architectCharacterId },
    }),
    input.proposedWitnessSoulId !== undefined
      ? Promise.resolve({ characterId: input.witnessCharacterId, soulId: input.proposedWitnessSoulId })
      : database.character.findUnique({ select: { characterId: true, soulId: true }, where: { characterId: input.witnessCharacterId } }),
    input.witnessDefId
      ? database.witnessDef.findUnique({ select: { witnessDefId: true, architectSoulId: true }, where: { witnessDefId: input.witnessDefId } })
      : Promise.resolve(null),
  ]);
  if (!architect) throw new ArchitectWitnessPopulationError(`Source Architect ${input.architectCharacterId} does not exist.`);
  if (architect.department === null) throw new ArchitectWitnessPopulationError("An ordinary Witness must reference a department-seat Architect.");
  if (!witnessCharacter) throw new ArchitectWitnessPopulationError(`Witness Character ${input.witnessCharacterId} does not exist.`);
  if (input.witnessDefId && !witnessDef) throw new ArchitectWitnessPopulationError(`WitnessDef ${input.witnessDefId} does not exist.`);
  try {
    assertWitnessArchitectSoulContinuity(witnessCharacter, architect.character);
    if (witnessDef && witnessDef.architectSoulId !== architect.character.soulId) throw new Error("WitnessDef Soul mismatch");
  } catch {
    throw continuityError({
      architectCharacterId: architect.character.characterId,
      architectSoulId: architect.character.soulId,
      witnessCharacterId: witnessCharacter.characterId,
      witnessSoulId: witnessCharacter.soulId,
      witnessDefId: witnessDef?.witnessDefId,
      witnessDefSoulId: witnessDef?.architectSoulId,
    });
  }
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalValue(item)]));
  }
  return value;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
}

function sameFields(existing: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([field, value]) => valuesEqual(existing[field], value));
}

async function validateBreedDependencies(transaction: Transaction): Promise<void> {
  const characterRows = [
    ...canonicalArchitectWitnessGuideData.architects.map(({ character }) => character),
    ...canonicalArchitectWitnessGuideData.witnesses.map(({ character }) => character),
    ...canonicalArchitectWitnessGuideData.guides.charactersToEnsure,
  ];
  const breedIds = [...new Set(characterRows.flatMap(({ breedId }) => breedId ? [breedId] : []))];
  const breeds = await transaction.breed.findMany({ select: { breedId: true, populationKind: true }, where: { breedId: { in: breedIds } } });
  const breedById = new Map(breeds.map((row) => [row.breedId, row]));
  const missingBreeds = breedIds.filter((breedId) => !breedById.has(breedId));
  const petWitnessBreeds = canonicalArchitectWitnessGuideData.witnesses
    .filter(({ character }) => character.breedId && breedById.get(character.breedId)?.populationKind === "PET")
    .map(({ character }) => character.breedId);
  if (missingBreeds.length || petWitnessBreeds.length) {
    throw new ArchitectWitnessPopulationError(
      `Canonical population prerequisites are unresolved. missingBreeds=${missingBreeds.join(",") || "none"} petWitnessBreeds=${petWitnessBreeds.join(",") || "none"}`,
    );
  }
}

async function ensureSoul(transaction: Transaction, expected: { soulId: string; name: string }, result: PopulationImportResult): Promise<void> {
  const existing = await transaction.soul.findUnique({ where: { soulId: expected.soulId } });
  if (!existing) {
    await transaction.soul.create({ data: expected });
    result.souls.created += 1;
  } else if (sameFields(existing, expected)) result.souls.unchanged += 1;
  else throw new ArchitectWitnessPopulationError(`Soul ${expected.soulId} conflicts with canonical identity ${expected.name}.`);
}

type CanonicalCharacter = (typeof canonicalArchitectWitnessGuideData.architects)[number]["character"];

async function ensureCharacter(transaction: Transaction, input: CanonicalCharacter, result: PopulationImportResult): Promise<void> {
  assertCanonicalCharacterBreedPolicy(input);
  const expected = {
    characterId: input.characterId,
    displayName: input.displayName,
    breedId: input.breedId,
    soulId: input.soulId,
    worldKey: input.worldKey,
    age: input.age,
    gender: input.gender,
  };
  const conflicting = await transaction.character.findFirst({
    select: { characterId: true },
    where: { displayName: expected.displayName, NOT: { characterId: expected.characterId } },
  });
  if (conflicting) throw new ArchitectWitnessPopulationError(`Character ${expected.displayName} already exists under alternate ID ${conflicting.characterId}.`);
  const existing = await transaction.character.findUnique({ where: { characterId: expected.characterId } });
  if (!existing) {
    await transaction.character.create({ data: expected });
    result.characters.created += 1;
  } else if (sameFields(existing, expected)) result.characters.unchanged += 1;
  else throw new ArchitectWitnessPopulationError(`Character ${expected.characterId} conflicts with the canonical input.`);
}

async function ensureArchitect(
  transaction: Transaction,
  expected: { characterId: string; department: ArchitectDepartment | null },
  result: PopulationImportResult,
): Promise<void> {
  const existing = await transaction.architect.findUnique({ where: { characterId: expected.characterId } });
  if (!existing) {
    await transaction.architect.create({ data: expected });
    result.architects.created += 1;
  } else if (existing.department === expected.department) result.architects.unchanged += 1;
  else throw new ArchitectWitnessPopulationError(`Architect ${expected.characterId} has conflicting department ${existing.department ?? "null"}.`);
}

type CanonicalWitnessDef = (typeof canonicalArchitectWitnessGuideData.witnessDefs)[number];

async function ensureWitnessDef(transaction: Transaction, definition: CanonicalWitnessDef, result: PopulationImportResult): Promise<void> {
  const expected = {
    witnessDefId: definition.witnessDefId,
    name: definition.name,
    department: definition.department,
    apparentDomain: definition.apparentDomain,
    realDomain: definition.realDomain,
    color: definition.color,
    architectSoulId: definition.architectSoulId,
  };
  const conflict = await transaction.witnessDef.findFirst({
    select: { witnessDefId: true },
    where: { OR: [{ department: definition.department }, { name: definition.name }], NOT: { witnessDefId: definition.witnessDefId } },
  });
  if (conflict) throw new ArchitectWitnessPopulationError(`WitnessDef ${definition.name} conflicts with existing ${conflict.witnessDefId}.`);
  const existing = await transaction.witnessDef.findUnique({ where: { witnessDefId: definition.witnessDefId } });
  if (!existing) {
    await transaction.witnessDef.create({ data: expected });
    result.witnessDefs.created += 1;
  } else if (sameFields(existing, expected)) result.witnessDefs.unchanged += 1;
  else throw new ArchitectWitnessPopulationError(`WitnessDef ${definition.witnessDefId} conflicts with the canonical input.`);
}

type CanonicalWitness = (typeof canonicalArchitectWitnessGuideData.witnesses)[number]["witness"];

async function ensureWitness(transaction: Transaction, expected: CanonicalWitness, result: PopulationImportResult): Promise<void> {
  await assertPersistedWitnessArchitectSoulContinuity(transaction, {
    architectCharacterId: expected.architectCharacterId,
    witnessCharacterId: expected.characterId,
    witnessDefId: expected.witnessDefId,
  });
  const existing = await transaction.witness.findUnique({ where: { characterId: expected.characterId } });
  if (!existing) {
    await transaction.witness.create({ data: expected });
    result.witnesses.created += 1;
  } else if (sameFields(existing, expected)) result.witnesses.unchanged += 1;
  else throw new ArchitectWitnessPopulationError(`Witness ${expected.characterId} conflicts with the canonical input.`);
}

export interface PopulationImportResult {
  souls: Counter;
  characters: Counter;
  architects: Counter;
  witnessDefs: Counter;
  witnesses: Counter;
}

function emptyResult(): PopulationImportResult {
  return {
    souls: { created: 0, unchanged: 0 },
    characters: { created: 0, unchanged: 0 },
    architects: { created: 0, unchanged: 0 },
    witnessDefs: { created: 0, unchanged: 0 },
    witnesses: { created: 0, unchanged: 0 },
  };
}

export async function importCanonicalArchitectWitnessPopulation(database: PrismaClient): Promise<PopulationImportResult> {
  return database.$transaction(async (transaction) => {
    await validateBreedDependencies(transaction);
    const result = emptyResult();

    for (const { soulId, name } of canonicalArchitectWitnessGuideData.souls) await ensureSoul(transaction, { soulId, name }, result);
    for (const row of canonicalArchitectWitnessGuideData.architects) {
      await ensureCharacter(transaction, row.character, result);
      await ensureArchitect(transaction, row.architect, result);
    }
    for (const character of canonicalArchitectWitnessGuideData.guides.charactersToEnsure) await ensureCharacter(transaction, character, result);
    for (const definition of canonicalArchitectWitnessGuideData.witnessDefs) await ensureWitnessDef(transaction, definition, result);
    for (const row of canonicalArchitectWitnessGuideData.witnesses) {
      await ensureCharacter(transaction, row.character, result);
      await ensureWitness(transaction, row.witness, result);
    }

    const audit = await auditArchitectWitnessPopulation(transaction as unknown as PrismaClient);
    if (audit.issues.length) throw new ArchitectWitnessPopulationError(`Canonical population audit failed: ${audit.issues.join(" | ")}`);
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function auditArchitectWitnessPopulation(database: PrismaClient) {
  const soulIds = canonicalArchitectWitnessGuideData.souls.map(({ soulId }) => soulId);
  const architectIds = canonicalArchitectWitnessGuideData.architects.map(({ character }) => character.characterId);
  const witnessIds = canonicalArchitectWitnessGuideData.witnesses.map(({ character }) => character.characterId);
  const guideOnlyIds = canonicalArchitectWitnessGuideData.guides.charactersToEnsure.map(({ characterId }) => characterId);
  const characterIds = [...architectIds, ...witnessIds, ...guideOnlyIds];
  const witnessDefIds = canonicalArchitectWitnessGuideData.witnessDefs.map(({ witnessDefId }) => witnessDefId);
  const [souls, characters, architects, definitions, witnesses] = await Promise.all([
    database.soul.findMany({ where: { soulId: { in: soulIds } } }),
    database.character.findMany({ where: { characterId: { in: characterIds } } }),
    database.architect.findMany({ where: { characterId: { in: architectIds } }, include: { character: true } }),
    database.witnessDef.findMany({ where: { witnessDefId: { in: witnessDefIds } } }),
    database.witness.findMany({ where: { characterId: { in: witnessIds } }, include: { character: true, architect: { include: { character: true } }, witnessDef: true } }),
  ]);
  const issues: string[] = [];
  if (souls.length !== 58) issues.push(`Expected 58 canonical Souls; found ${souls.length}.`);
  if (characters.length !== 112) issues.push(`Expected 112 canonical Characters; found ${characters.length}.`);
  if (architects.length !== 56) issues.push(`Expected 56 canonical Architects; found ${architects.length}.`);
  if (definitions.length !== 54) issues.push(`Expected 54 canonical WitnessDefs; found ${definitions.length}.`);
  if (witnesses.length !== 54) issues.push(`Expected 54 canonical Witnesses; found ${witnesses.length}.`);

  const departmentArchitects = architects.filter(({ department }) => department !== null);
  if (departmentArchitects.length !== 54 || new Set(departmentArchitects.map(({ department }) => department)).size !== 54) issues.push("The 54 department seats are not complete and unique.");
  for (const id of presidingIds) {
    const architect = architects.find(({ characterId }) => characterId === id);
    if (!architect || architect.department !== null) issues.push(`Presiding Architect ${id} must exist with department null.`);
  }

  const frank = characters.find(({ characterId }) => characterId === "CHA_FRANK_ADRIAN_VOSS");
  const mother = characters.find(({ characterId }) => characterId === "CHA_MOTHER");
  if (!frank) issues.push("Frank Adrian Voss is missing.");
  if (!mother || mother.breedId !== null || mother.soulId !== "SOUL_MOTHER") issues.push("Mother must exist as the AI Character with a null Breed and SOUL_MOTHER.");
  const unauthorizedNullBreedCharacters = characters.filter(({ characterId, breedId }) => breedId === null && !canonicalNonBiologicalCharacterIds.includes(characterId));
  if (unauthorizedNullBreedCharacters.length) issues.push(`Unauthorized null-Breed canonical Characters: ${unauthorizedNullBreedCharacters.map(({ characterId }) => characterId).join(",")}.`);
  if (architects.some(({ character }) => character.breedId === null)) issues.push("Every canonical Architect Character must have a Breed.");
  if (witnesses.some(({ character }) => character.breedId === null)) issues.push("Every canonical Witness Character must have a Breed.");
  for (const requiredBreedId of ["CHA_FRANK_ADRIAN_VOSS", "CHA_HANS_HALYCON_HOHENZOLLERN", "CHA_NOELL_PIETER_SMUKK"]) {
    if (!characters.find(({ characterId }) => characterId === requiredBreedId)?.breedId) issues.push(`${requiredBreedId} must have a Breed.`);
  }
  if (architects.some(({ characterId }) => guideOnlyIds.includes(characterId)) || witnesses.some(({ characterId }) => guideOnlyIds.includes(characterId))) {
    issues.push("Frank and Mother cannot have Architect or Witness subtypes in this tranche.");
  }

  const chains = witnesses.map((witness) => ({ architect: witness.architect.character, witness: witness.character }));
  for (const witness of witnesses) {
    try {
      assertWitnessArchitectSoulContinuity(witness.character, witness.architect.character);
      if (witness.witnessDef.architectSoulId !== witness.architect.character.soulId) throw new Error("Definition Soul mismatch");
    } catch {
      issues.push(continuityError({
        architectCharacterId: witness.architectCharacterId,
        architectSoulId: witness.architect.character.soulId,
        witnessCharacterId: witness.characterId,
        witnessSoulId: witness.character.soulId,
        witnessDefId: witness.witnessDefId,
        witnessDefSoulId: witness.witnessDef.architectSoulId,
      }).message);
    }
    if (witness.architect.department === null) issues.push(`Witness ${witness.characterId} points to a presiding Architect.`);
    if (witness.witnessDef.department !== witness.architect.department) issues.push(`Witness ${witness.characterId} definition department differs from its source Architect.`);
    const color = witness.witnessDef.color as Record<string, number>;
    if (Object.keys(color).sort().join(",") !== "GREEN,SPECTRAL_VIOLET,WHITE" || Math.abs(Object.values(color).reduce((sum, value) => sum + value, 0) - 100) > 0.000001) {
      issues.push(`WitnessDef ${witness.witnessDefId} has invalid canonical color percentages.`);
    }
  }
  if (chains.length === 54) {
    try { assertDistinctWitnessSoulChains(chains); } catch (error) { issues.push(error instanceof Error ? error.message : String(error)); }
  }
  for (const pair of canonicalArchitectWitnessRoster.compositePresentations) {
    const pairRows = pair.map((name) => witnesses.find(({ character }) => character.displayName === name)).filter(Boolean);
    if (pairRows.length !== 2 || new Set(pairRows.map((row) => row!.character.soulId)).size !== 2) issues.push(`Composite pair ${pair.join(" + ")} does not preserve two independent Soul chains.`);
  }
  for (const guide of canonicalArchitectWitnessGuideData.guides.guides) {
    const character = characters.find(({ characterId }) => characterId === guide.characterId);
    if (!character || character.soulId !== guide.soulId || character.displayName !== guide.underlyingDisplayName) issues.push(`Guide ${guide.title} does not resolve its canonical underlying Character and Soul.`);
  }
  return {
    counts: { souls: souls.length, characters: characters.length, architects: architects.length, witnessDefs: definitions.length, witnesses: witnesses.length, guideMappings: 3 },
    issues,
  };
}
