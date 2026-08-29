import { describe, expect, it } from "vitest";

import { canonicalArchitectWitnessGuideData, canonicalArchitectWitnessRoster, canonicalCharacterId, canonicalSoulId } from "../../src/domain/architect-witness";
import {
  assertPersistedWitnessArchitectSoulContinuity,
  auditArchitectWitnessPopulation,
  importCanonicalArchitectWitnessPopulation,
} from "../../src/server/architect-witness-import";

type DataArgument = { data: Record<string, unknown> };
type SoulIdArgument = { where: { soulId: string } };
type SoulIdsArgument = { where: { soulId: { in: string[] } } };
type CharacterIdArgument = { where: { characterId: string }; include?: unknown };
type CharacterIdsArgument = { where: { characterId: { in: string[] } } };
type CharacterNameArgument = { where: { displayName: string; NOT: { characterId: string } } };

function inMemoryDatabase(options: { corruptWitnessSoul?: boolean } = {}) {
  const souls = new Map<string, Record<string, unknown>>();
  const characters = new Map<string, Record<string, unknown>>();
  const architects = new Map<string, Record<string, unknown>>();
  const witnesses = new Map<string, Record<string, unknown>>();
  const witnessDefs = new Map<string, Record<string, unknown>>();
  const architectBreedIds = new Set([
    ...canonicalArchitectWitnessRoster.ordinaryTransformations.map(({ architectBreedId }) => architectBreedId),
    ...canonicalArchitectWitnessRoster.presidingArchitects.map(({ breedId }) => breedId),
    ...canonicalArchitectWitnessRoster.otherCharacters.flatMap(({ breedId }) => breedId ? [breedId] : []),
  ]);
  const breedIds = new Set(canonicalArchitectWitnessRoster.ordinaryTransformations.flatMap(({ architectBreedId, witnessBreedId }) => [architectBreedId, witnessBreedId]));
  for (const row of [...canonicalArchitectWitnessRoster.presidingArchitects, ...canonicalArchitectWitnessRoster.otherCharacters]) if (row.breedId) breedIds.add(row.breedId);

  const client = {
    breed: {
      findMany: async () => [...breedIds].map((breedId) => ({ breedId, populationKind: architectBreedIds.has(breedId) ? "HUMAN" : "BEAST" })),
    },
    witnessDef: {
      findFirst: async ({ where }: { where: { OR: Array<Record<string, unknown>>; NOT: { witnessDefId: string } } }) => [...witnessDefs.values()].find((row) => row.witnessDefId !== where.NOT.witnessDefId && where.OR.some((clause) => Object.entries(clause).every(([field, value]) => row[field] === value))) ?? null,
      findUnique: async ({ where: { witnessDefId } }: { where: { witnessDefId: string } }) => witnessDefs.get(witnessDefId) ?? null,
      create: async ({ data }: DataArgument) => { witnessDefs.set(String(data.witnessDefId), { ...data }); return data; },
      findMany: async () => [...witnessDefs.values()],
    },
    soul: {
      findUnique: async ({ where: { soulId } }: SoulIdArgument) => souls.get(soulId) ?? null,
      create: async ({ data }: DataArgument) => { souls.set(String(data.soulId), { ...data }); return data; },
      findMany: async ({ where: { soulId: { in: ids } } }: SoulIdsArgument) => ids.flatMap((id) => souls.get(id) ?? []),
    },
    character: {
      findFirst: async ({ where }: CharacterNameArgument) => [...characters.values()].find((row) => row.displayName === where.displayName && row.characterId !== where.NOT.characterId) ?? null,
      findUnique: async ({ where: { characterId } }: CharacterIdArgument) => characters.get(characterId) ?? null,
      create: async ({ data }: DataArgument) => {
        const stored = { ...data };
        if (options.corruptWitnessSoul && data.displayName === "The Witness of the Summit") stored.soulId = "SOUL_WRONG";
        characters.set(String(data.characterId), stored);
        return stored;
      },
      update: async ({ data, where: { characterId } }: DataArgument & { where: { characterId: string } }) => {
        const stored = { ...characters.get(characterId), ...data };
        characters.set(characterId, stored);
        return stored;
      },
      findMany: async ({ where: { characterId: { in: ids } } }: CharacterIdsArgument) => ids.flatMap((id) => characters.get(id) ?? []),
    },
    architect: {
      findUnique: async ({ where: { characterId }, include }: CharacterIdArgument) => {
        const row = architects.get(characterId);
        return row && include ? { ...row, character: characters.get(characterId) } : row ?? null;
      },
      create: async ({ data }: DataArgument) => { architects.set(String(data.characterId), { ...data }); return data; },
      findMany: async ({ where: { characterId: { in: ids } } }: CharacterIdsArgument) => ids.flatMap((id) => {
        const row = architects.get(id);
        return row ? [{ ...row, character: characters.get(id) }] : [];
      }),
    },
    witness: {
      findUnique: async ({ where: { characterId } }: CharacterIdArgument) => witnesses.get(characterId) ?? null,
      create: async ({ data }: DataArgument) => { witnesses.set(String(data.characterId), { ...data }); return data; },
      findMany: async ({ where: { characterId: { in: ids } } }: CharacterIdsArgument) => ids.flatMap((id) => {
        const row = witnesses.get(id);
        if (!row) return [];
        const architect = architects.get(String(row.architectCharacterId))!;
        const witnessDef = witnessDefs.get(String(row.witnessDefId))!;
        return [{ ...row, character: characters.get(id), architect: { ...architect, character: characters.get(String(row.architectCharacterId)) }, witnessDef }];
      }),
    },
    async $transaction(work: (transaction: unknown) => Promise<unknown>) {
      const snapshots = [souls, characters, architects, witnessDefs, witnesses].map((store) => new Map(store));
      try { return await work(client); }
      catch (error) {
        [souls, characters, architects, witnessDefs, witnesses].forEach((store, index) => { store.clear(); for (const [key, value] of snapshots[index]!) store.set(key, value); });
        throw error;
      }
    },
  };
  return { client, stores: { souls, characters, architects, witnessDefs, witnesses } };
}

describe("canonical Architect/Witness population import", () => {
  it.each([
    "Hans Halycon Hohenzollern",
    "Noell Pieter Smukk",
  ])("rejects %s as an ordinary Witness source", async (architectName) => {
    await expect(assertPersistedWitnessArchitectSoulContinuity({} as never, {
      architectCharacterId: canonicalCharacterId(architectName),
      witnessCharacterId: "CHA_WITNESS",
      proposedWitnessSoulId: "SOUL_WITNESS",
    })).rejects.toThrow("Hans and Noell cannot be ordinary concrete Witness sources.");
  });

  it("imports one batch, preserves independent paired Souls, and reruns idempotently", async () => {
    const database = inMemoryDatabase();
    await expect(importCanonicalArchitectWitnessPopulation(database.client as never)).resolves.toMatchObject({
      souls: { created: 58, unchanged: 0 },
      characters: { created: 112, unchanged: 0, updated: 0 },
      architects: { created: 56, unchanged: 0 },
      witnessDefs: { created: 54, unchanged: 0 },
      witnesses: { created: 54, unchanged: 0 },
    });
    await expect(auditArchitectWitnessPopulation(database.client as never)).resolves.toEqual({
      counts: { souls: 58, characters: 112, architects: 56, witnessDefs: 54, witnesses: 54, guideMappings: 3 },
      issues: [],
    });
    await expect(importCanonicalArchitectWitnessPopulation(database.client as never)).resolves.toMatchObject({
      souls: { created: 0, unchanged: 58 },
      characters: { created: 0, unchanged: 112, updated: 0 },
      architects: { created: 0, unchanged: 56 },
      witnessDefs: { created: 0, unchanged: 54 },
      witnesses: { created: 0, unchanged: 54 },
    });
    for (const pair of canonicalArchitectWitnessRoster.compositePresentations) {
      const soulIds = pair.map((name) => database.stores.characters.get(canonicalCharacterId(name))?.soulId);
      expect(new Set(soulIds).size).toBe(2);
    }
    expect(database.stores.architects.get(canonicalCharacterId("Hans Halycon Hohenzollern"))?.department).toBeNull();
    expect(database.stores.architects.get(canonicalCharacterId("Noell Pieter Smukk"))?.department).toBeNull();
    expect(database.stores.witnesses.has(canonicalCharacterId("Hans Halycon Hohenzollern"))).toBe(false);
    expect(database.stores.witnesses.has(canonicalCharacterId("Noell Pieter Smukk"))).toBe(false);
    expect(database.stores.characters.get(canonicalCharacterId("Frank Adrian Voss"))?.soulId).toBe(canonicalSoulId("Frank Adrian Voss"));
    expect(database.stores.characters.get("CHA_MOTHER")).toEqual(expect.objectContaining({ breedId: null, soulId: "SOUL_MOTHER" }));
    expect(database.stores.witnessDefs.size).toBe(canonicalArchitectWitnessGuideData.witnessDefs.length);
    expect(database.stores.witnessDefs.get("WDF_WITNESS_OF_THE_SUMMIT")).toMatchObject({
      bookNumber: 3,
      kernelKey: "HUMILITY",
      worldKey: "CONCORD",
    });
    for (const definition of canonicalArchitectWitnessGuideData.witnessDefs) {
      expect(
        Object.keys(database.stores.witnessDefs.get(definition.witnessDefId) ?? {}).sort(),
        `${definition.witnessDefId} source keys must survive import`,
      ).toEqual(Object.keys(definition).sort());
    }
    expect(database.stores.characters.get("CHA_WITNESS_OF_THE_HAMMER")).toMatchObject({ age: "53", gender: "MALE" });
    expect(database.stores.characters.get("CHA_WITNESS_OF_THE_LOOM")).toMatchObject({ age: "50", gender: "MALE" });
    expect(database.stores.characters.get("CHA_WITNESS_OF_PATCHWORK")).toMatchObject({ age: "52", gender: "FEMALE" });
  });

  it("backfills only missing authoritative Character presentation and then becomes idempotent", async () => {
    const database = inMemoryDatabase();
    await importCanonicalArchitectWitnessPopulation(database.client as never);
    const andrei = database.stores.characters.get("CHA_ANDREI_MIHAI_POPESCU")!;
    for (const field of ["skinScaleColor", "hairFurColor", "eyeColor", "clothing"] as const) andrei[field] = null;
    database.stores.characters.get("CHA_WITNESS_OF_THE_HAMMER")!.gender = null;
    database.stores.characters.get("CHA_WITNESS_OF_THE_HAMMER")!.age = null;

    await expect(importCanonicalArchitectWitnessPopulation(database.client as never)).resolves.toMatchObject({
      characters: { created: 0, updated: 2, unchanged: 110 },
    });
    expect(database.stores.characters.get("CHA_ANDREI_MIHAI_POPESCU")).toMatchObject({
      clothing: expect.stringContaining("Charcoal suit"),
      eyeColor: "dark brown",
      gender: "MALE",
      hairFurColor: expect.stringContaining("salt-and-pepper"),
      skinScaleColor: "light olive-fair",
    });
    expect(database.stores.characters.get("CHA_WITNESS_OF_THE_HAMMER")?.gender).toBe("MALE");
    expect(database.stores.characters.get("CHA_WITNESS_OF_THE_HAMMER")?.age).toBe("53");
    await expect(importCanonicalArchitectWitnessPopulation(database.client as never)).resolves.toMatchObject({
      characters: { created: 0, updated: 0, unchanged: 112 },
    });
  });

  it("rolls back the entire same-batch import when one Witness Soul differs", async () => {
    const database = inMemoryDatabase({ corruptWitnessSoul: true });
    await expect(importCanonicalArchitectWitnessPopulation(database.client as never)).rejects.toThrow("Witness and source Architect must reference the same Soul");
    expect(database.stores.souls.size).toBe(0);
    expect(database.stores.characters.size).toBe(0);
    expect(database.stores.architects.size).toBe(0);
    expect(database.stores.witnesses.size).toBe(0);
  });
});
