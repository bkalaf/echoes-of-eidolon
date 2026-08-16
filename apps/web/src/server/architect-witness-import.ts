import {
  canonicalArchitectWitnessRoster,
  canonicalCharacterId,
  canonicalSoulId,
} from "../domain/architect-witness";
import {
  assertDistinctWitnessSoulChains,
  assertWitnessArchitectSoulContinuity,
} from "../domain/invariants";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import type { ArchitectDepartment } from "../generated/prisma/enums";

type Transaction = Prisma.TransactionClient;

const presidingIds = new Set([
  canonicalCharacterId("Hans Halycon Hohenzollern"),
  canonicalCharacterId("Noell Pieter Smukk"),
]);

export class ArchitectWitnessPopulationError extends Error {
  override name = "ArchitectWitnessPopulationError";
}

function continuityError(input: {
  architectCharacterId: string;
  architectSoulId: string | null;
  witnessCharacterId: string;
  witnessSoulId: string | null;
}): ArchitectWitnessPopulationError {
  return new ArchitectWitnessPopulationError(
    `Witness and source Architect must reference the same Soul. witnessCharacterId=${input.witnessCharacterId} architectCharacterId=${input.architectCharacterId} witnessSoulId=${input.witnessSoulId ?? "null"} architectSoulId=${input.architectSoulId ?? "null"}`,
  );
}

export async function assertPersistedWitnessArchitectSoulContinuity(
  database: Pick<Transaction, "architect" | "character">,
  input: { architectCharacterId: string; witnessCharacterId: string; proposedWitnessSoulId?: string | null },
): Promise<void> {
  if (presidingIds.has(input.architectCharacterId)) throw new ArchitectWitnessPopulationError("Hans and Noell cannot be ordinary concrete Witness sources.");
  const [architect, witnessCharacter] = await Promise.all([
    database.architect.findUnique({
      include: { character: { select: { characterId: true, soulId: true } } },
      where: { characterId: input.architectCharacterId },
    }),
    input.proposedWitnessSoulId !== undefined
      ? Promise.resolve({ characterId: input.witnessCharacterId, soulId: input.proposedWitnessSoulId })
      : database.character.findUnique({ select: { characterId: true, soulId: true }, where: { characterId: input.witnessCharacterId } }),
  ]);
  if (!architect) throw new ArchitectWitnessPopulationError(`Source Architect ${input.architectCharacterId} does not exist.`);
  if (architect.department === null) throw new ArchitectWitnessPopulationError("An ordinary Witness must reference a department-seat Architect.");
  if (!witnessCharacter) throw new ArchitectWitnessPopulationError(`Witness Character ${input.witnessCharacterId} does not exist.`);
  try {
    assertWitnessArchitectSoulContinuity(witnessCharacter, architect.character);
  } catch {
    throw continuityError({
      architectCharacterId: architect.character.characterId,
      architectSoulId: architect.character.soulId,
      witnessCharacterId: witnessCharacter.characterId,
      witnessSoulId: witnessCharacter.soulId,
    });
  }
}

async function canonicalDependencies(transaction: Transaction) {
  const rows = canonicalArchitectWitnessRoster.ordinaryTransformations;
  const breedIds = [...new Set([
    ...rows.flatMap(({ architectBreedId, witnessBreedId }) => [architectBreedId, witnessBreedId]),
    ...canonicalArchitectWitnessRoster.presidingArchitects.map(({ breedId }) => breedId),
    ...canonicalArchitectWitnessRoster.otherCharacters.map(({ breedId }) => breedId),
  ])];
  const [breeds, witnessDefs] = await Promise.all([
    transaction.breed.findMany({ select: { breedId: true, populationKind: true }, where: { breedId: { in: breedIds } } }),
    transaction.witnessDef.findMany({ orderBy: { witnessDefId: "asc" } }),
  ]);
  const breedById = new Map(breeds.map((row) => [row.breedId, row]));
  const missingBreeds = breedIds.filter((breedId) => !breedById.has(breedId));
  const petWitnessBreeds = rows.filter(({ witnessBreedId }) => breedById.get(witnessBreedId)?.populationKind === "PET").map(({ witnessBreedId }) => witnessBreedId);
  const definitionByDepartment = new Map(witnessDefs.map((definition) => [definition.department, definition]));
  const definitionErrors = rows.flatMap((row) => {
    const definition = definitionByDepartment.get(row.department);
    if (!definition) return [`${row.department}:${row.witnessName}`];
    return definition.name === row.witnessName ? [] : [`${row.department}:expected=${row.witnessName}:actual=${definition.name}`];
  });
  if (missingBreeds.length || petWitnessBreeds.length || definitionErrors.length) {
    throw new ArchitectWitnessPopulationError(
      `Canonical population prerequisites are unresolved. missingBreeds=${missingBreeds.join(",") || "none"} petWitnessBreeds=${petWitnessBreeds.join(",") || "none"} witnessDefErrors=${definitionErrors.join(",") || "none"}`,
    );
  }
  return { definitionByDepartment };
}

function sameFields(existing: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([field, value]) => existing[field] === value);
}

async function ensureSoul(transaction: Transaction, soulId: string, name: string, result: PopulationImportResult): Promise<void> {
  const existing = await transaction.soul.findUnique({ where: { soulId } });
  if (!existing) {
    await transaction.soul.create({ data: { soulId, name } });
    result.souls.created += 1;
  } else if (existing.name === name) result.souls.unchanged += 1;
  else throw new ArchitectWitnessPopulationError(`Soul ${soulId} conflicts with canonical identity ${name}.`);
}

async function ensureCharacter(
  transaction: Transaction,
  expected: { characterId: string; displayName: string; breedId: string; soulId: string },
  result: PopulationImportResult,
): Promise<void> {
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
  else throw new ArchitectWitnessPopulationError(`Character ${expected.characterId} conflicts with the canonical roster.`);
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

async function ensureWitness(
  transaction: Transaction,
  expected: { characterId: string; witnessDefId: string; architectCharacterId: string },
  result: PopulationImportResult,
): Promise<void> {
  await assertPersistedWitnessArchitectSoulContinuity(transaction, {
    architectCharacterId: expected.architectCharacterId,
    witnessCharacterId: expected.characterId,
  });
  const existing = await transaction.witness.findUnique({ where: { characterId: expected.characterId } });
  if (!existing) {
    await transaction.witness.create({ data: { ...expected, trueFlawName: null, legendaryRewardId: null } });
    result.witnesses.created += 1;
  } else if (sameFields(existing, expected)) result.witnesses.unchanged += 1;
  else throw new ArchitectWitnessPopulationError(`Witness ${expected.characterId} conflicts with the canonical roster.`);
}

export interface PopulationImportResult {
  souls: { created: number; unchanged: number };
  characters: { created: number; unchanged: number };
  architects: { created: number; unchanged: number };
  witnesses: { created: number; unchanged: number };
}

function emptyResult(): PopulationImportResult {
  return {
    souls: { created: 0, unchanged: 0 },
    characters: { created: 0, unchanged: 0 },
    architects: { created: 0, unchanged: 0 },
    witnesses: { created: 0, unchanged: 0 },
  };
}

export async function importCanonicalArchitectWitnessPopulation(database: PrismaClient): Promise<PopulationImportResult> {
  return database.$transaction(async (transaction) => {
    const { definitionByDepartment } = await canonicalDependencies(transaction);
    const result = emptyResult();

    for (const row of canonicalArchitectWitnessRoster.ordinaryTransformations) await ensureSoul(transaction, canonicalSoulId(row.architectName), row.architectName, result);
    for (const row of [...canonicalArchitectWitnessRoster.presidingArchitects, ...canonicalArchitectWitnessRoster.otherCharacters]) await ensureSoul(transaction, canonicalSoulId(row.displayName), row.displayName, result);

    for (const row of canonicalArchitectWitnessRoster.ordinaryTransformations) {
      const architectCharacterId = canonicalCharacterId(row.architectName);
      const soulId = canonicalSoulId(row.architectName);
      await ensureCharacter(transaction, { characterId: architectCharacterId, displayName: row.architectName, breedId: row.architectBreedId, soulId }, result);
      await ensureArchitect(transaction, { characterId: architectCharacterId, department: row.department }, result);
    }
    for (const row of canonicalArchitectWitnessRoster.presidingArchitects) {
      const characterId = canonicalCharacterId(row.displayName);
      await ensureCharacter(transaction, { characterId, displayName: row.displayName, breedId: row.breedId, soulId: canonicalSoulId(row.displayName) }, result);
      await ensureArchitect(transaction, { characterId, department: null }, result);
    }
    for (const row of canonicalArchitectWitnessRoster.otherCharacters) {
      await ensureCharacter(transaction, { characterId: canonicalCharacterId(row.displayName), displayName: row.displayName, breedId: row.breedId, soulId: canonicalSoulId(row.displayName) }, result);
    }

    for (const row of canonicalArchitectWitnessRoster.ordinaryTransformations) {
      const soulId = canonicalSoulId(row.architectName);
      const witnessCharacterId = canonicalCharacterId(row.witnessName);
      await ensureCharacter(transaction, { characterId: witnessCharacterId, displayName: row.witnessName, breedId: row.witnessBreedId, soulId }, result);
      const witnessDef = definitionByDepartment.get(row.department)!;
      await ensureWitness(transaction, { characterId: witnessCharacterId, witnessDefId: witnessDef.witnessDefId, architectCharacterId: canonicalCharacterId(row.architectName) }, result);
    }

    const audit = await auditArchitectWitnessPopulation(transaction as unknown as PrismaClient);
    if (audit.issues.length) throw new ArchitectWitnessPopulationError(`Canonical population audit failed: ${audit.issues.join(" | ")}`);
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function auditArchitectWitnessPopulation(database: PrismaClient) {
  const rows = canonicalArchitectWitnessRoster.ordinaryTransformations;
  const ordinaryArchitectIds = rows.map(({ architectName }) => canonicalCharacterId(architectName));
  const witnessIds = rows.map(({ witnessName }) => canonicalCharacterId(witnessName));
  const presidingCharacterIds = canonicalArchitectWitnessRoster.presidingArchitects.map(({ displayName }) => canonicalCharacterId(displayName));
  const frankId = canonicalCharacterId("Frank Adrian Voss");
  const allCharacterIds = [...ordinaryArchitectIds, ...witnessIds, ...presidingCharacterIds, frankId];
  const [souls, characters, architects, witnesses] = await Promise.all([
    database.soul.findMany({ where: { soulId: { in: [
      ...rows.map(({ architectName }) => canonicalSoulId(architectName)),
      ...canonicalArchitectWitnessRoster.presidingArchitects.map(({ displayName }) => canonicalSoulId(displayName)),
      canonicalSoulId("Frank Adrian Voss"),
    ] } } }),
    database.character.findMany({ where: { characterId: { in: allCharacterIds } } }),
    database.architect.findMany({ where: { characterId: { in: [...ordinaryArchitectIds, ...presidingCharacterIds] } }, include: { character: true } }),
    database.witness.findMany({ where: { characterId: { in: witnessIds } }, include: { character: true, architect: { include: { character: true } }, witnessDef: true } }),
  ]);
  const issues: string[] = [];
  if (souls.length !== 57) issues.push(`Expected 57 canonical Souls; found ${souls.length}.`);
  if (characters.length !== 111) issues.push(`Expected 111 canonical Characters; found ${characters.length}.`);
  if (architects.length !== 56) issues.push(`Expected 56 canonical Architects; found ${architects.length}.`);
  if (witnesses.length !== 54) issues.push(`Expected 54 canonical Witnesses; found ${witnesses.length}.`);
  const departmentArchitects = architects.filter(({ department }) => department !== null);
  if (departmentArchitects.length !== 54 || new Set(departmentArchitects.map(({ department }) => department)).size !== 54) issues.push("The 54 department seats are not complete and unique.");
  for (const id of presidingCharacterIds) {
    const architect = architects.find(({ characterId }) => characterId === id);
    if (architect && architect.department !== null) issues.push(`Presiding Architect ${id} must have department null.`);
  }
  const frank = characters.find(({ characterId }) => characterId === frankId);
  if (frank && (architects.some(({ characterId }) => characterId === frankId) || witnesses.some(({ characterId }) => characterId === frankId))) issues.push("Frank Adrian Voss cannot have an Architect or Witness subtype.");
  const chains = witnesses.map((witness) => ({
    architect: witness.architect.character,
    witness: witness.character,
  }));
  for (const witness of witnesses) {
    try { assertWitnessArchitectSoulContinuity(witness.character, witness.architect.character); }
    catch { issues.push(continuityError({ architectCharacterId: witness.architectCharacterId, architectSoulId: witness.architect.character.soulId, witnessCharacterId: witness.characterId, witnessSoulId: witness.character.soulId }).message); }
    if (witness.architect.department === null) issues.push(`Witness ${witness.characterId} points to a presiding Architect.`);
    if (witness.witnessDef.department !== witness.architect.department) issues.push(`Witness ${witness.characterId} definition department differs from its source Architect.`);
  }
  if (chains.length === 54) {
    try { assertDistinctWitnessSoulChains(chains); } catch (error) { issues.push(error instanceof Error ? error.message : String(error)); }
  }
  for (const pair of canonicalArchitectWitnessRoster.compositePresentations) {
    const pairRows = pair.map((name) => witnesses.find(({ characterId }) => characterId === canonicalCharacterId(name))).filter(Boolean);
    if (pairRows.length === 2 && new Set(pairRows.map((row) => row!.character.soulId)).size !== 2) issues.push(`Composite pair ${pair.join(" + ")} improperly shares one Soul.`);
  }
  return {
    counts: { souls: souls.length, characters: characters.length, architects: architects.length, witnesses: witnesses.length },
    issues,
  };
}
