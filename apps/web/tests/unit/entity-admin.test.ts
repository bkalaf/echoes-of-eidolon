import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import contractData from "../../src/data/entity-admin-contract.json";

import { entityFields } from "../../src/content/entities";
import { applyGenericEntityImport, createEntityRecord, entityAdminContract, EntityAdminValidationError, getEntityRecord, listEntityRecords, normalizeEntityData, updateEntityRecord } from "../../src/server/entity-admin";

function soulDatabase(existing: Record<string, unknown> | null = null) {
  const delegate = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    delete: vi.fn(async ({ where }: { where: Record<string, unknown> }) => where),
    findMany: vi.fn(async () => existing ? [existing] : []),
    findUnique: vi.fn(async () => existing),
    update: vi.fn(async ({ data, where }: { data: Record<string, unknown>; where: Record<string, unknown> }) => ({ ...where, ...data })),
  };
  const transaction = { soul: delegate };
  return { database: { ...transaction, $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) }, delegate };
}

describe("closed-world generic entity administration", () => {
  it("audits every persisted Prisma field independently of the generic-form whitelist", () => {
    const schema = readFileSync(resolve(import.meta.dirname, "../../prisma/schema.prisma"), "utf8");
    const auditModels = contractData.auditModels as Record<string, { fields: Array<{ name: string }> }>;
    for (const match of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
      const expected = [...match[2].matchAll(/^\s{2}(\w+)\s+[A-Za-z]/gm)].map((field) => field[1]);
      expect(auditModels[match[1]!]?.fields.map((field) => field.name), match[1]).toEqual(expected);
    }
    expect(auditModels.Character.fields.map((field) => field.name)).toEqual(expect.arrayContaining(["displayName", "breedId", "occupationId", "worldKey", "soulId", "gender", "age", "faction", "primaryAttribute", "secondaryAttribute"]));
    expect(auditModels).toHaveProperty("WitnessDef");
    expect(auditModels).toHaveProperty("CompanionDef");
    expect(auditModels).not.toHaveProperty("Protagonist");
    expect(auditModels).not.toHaveProperty("Antagonist");
  });

  it("retains owning foreign-key metadata for every Prisma relation", () => {
    const breedFields = contractData.entities.Breed.auditFields as Array<{ name: string; relationFromFields?: string[] }>;
    const witnessFields = contractData.entities.Witness.auditFields as Array<{ name: string; relationFromFields?: string[] }>;
    expect(breedFields.find(({ name }) => name === "species")?.relationFromFields).toEqual(["speciesId"]);
    expect(breedFields.find(({ name }) => name === "childBreeds")?.relationFromFields).toEqual([]);
    expect(witnessFields.find(({ name }) => name === "architect")?.relationFromFields).toEqual(["architectCharacterId"]);
  });
  it("generates contracts for every registered authorable entity except the specialized Capability root", () => {
    for (const entity of Object.keys(entityFields)) {
      if (entity === "CapabilityDefinition") continue;
      const typedEntity = entity as keyof typeof entityFields;
      const contract = entityAdminContract(typedEntity);
      expect(contract.fields.map(({ name }) => name)).toEqual(entityFields[typedEntity]);
      expect(contract.idField).toBe(entityFields[typedEntity][0]);
    }
    expect(() => entityAdminContract("CapabilityDefinition")).toThrow(/Generic authoring is unavailable/);
  });

  it("normalizes scalar, list, JSON, enum, and optional values while rejecting unknown fields", () => {
    expect(normalizeEntityData("Transition", { transitionId: "TR-1", name: "Bridge", bookA: "1", bookB: 18, summary: "Mirror" }, "create")).toEqual({ transitionId: "TR-1", name: "Bridge", bookA: 1, bookB: 18, summary: "Mirror" });
    expect(normalizeEntityData("Species", { speciesId: "SP-1", name: "Otter", speciesKind: "BEAST", scientificName: "", taxonomyLevelId: "TAX_SPECIES_LUTRA_LUTRA", traits: [], appearance: "brown", originMode: "UNKNOWN", reproductiveMethod: "UNKNOWN", juvenileStages: [], nurseryMode: [], longevityClass: "UNKNOWN", mortalityMode: "UNKNOWN", soulDisposition: "UNKNOWN", continuityGroup: "UNKNOWN", continuityPropagationMode: "UNKNOWN" }, "create")).toMatchObject({ scientificName: null, appearance: "brown", taxonomyLevelId: "TAX_SPECIES_LUTRA_LUTRA" });
    expect(() => normalizeEntityData("Soul", { soulId: "S-1", name: "Soul", invented: true }, "create")).toThrow(EntityAdminValidationError);
  });

  it("lists, reads, creates, and updates through the exact allowlisted delegate", async () => {
    const existing = { soulId: "SOUL-1", name: "First" };
    const { database, delegate } = soulDatabase(existing);
    await expect(listEntityRecords(database as never, "Soul")).resolves.toEqual([existing]);
    await expect(getEntityRecord(database as never, "Soul", "SOUL-1")).resolves.toEqual(existing);
    await expect(createEntityRecord(database as never, "Soul", { soulId: "SOUL-2", name: "Second" })).resolves.toEqual({ soulId: "SOUL-2", name: "Second" });
    await expect(updateEntityRecord(database as never, "Soul", "SOUL-1", { soulId: "SOUL-1", name: "Renamed" })).resolves.toEqual({ soulId: "SOUL-1", name: "Renamed" });
    expect(delegate.findMany).toHaveBeenCalledWith({ orderBy: { soulId: "asc" } });
    expect(delegate.update).toHaveBeenCalledWith({ data: { name: "Renamed" }, where: { soulId: "SOUL-1" } });
  });

  it("loads owning to-one relations needed for human-readable lookup presentation", async () => {
    const findMany = vi.fn(async () => []);
    const findUnique = vi.fn(async () => null);
    const database = { breed: { findMany, findUnique } };
    await listEntityRecords(database as never, "Breed");
    await getEntityRecord(database as never, "Breed", "BRD_AARDVARK");
    const include = { culture: true, parentBreed: true, personality: true, species: true };
    expect(findMany).toHaveBeenCalledWith({ include, orderBy: { breedId: "asc" } });
    expect(findUnique).toHaveBeenCalledWith({ include, where: { breedId: "BRD_AARDVARK" } });
  });

  it("imports atomically, stays idempotent, and refuses canonical drift", async () => {
    const fresh = soulDatabase(null);
    await expect(applyGenericEntityImport([{ soulId: "SOUL-1", name: "First" }], "Soul", fresh.database as never)).resolves.toEqual({ changed: 1, unchanged: 0 });
    expect(fresh.database.$transaction).toHaveBeenCalledOnce();

    const exact = soulDatabase({ soulId: "SOUL-1", name: "First" });
    await expect(applyGenericEntityImport([{ soulId: "SOUL-1", name: "First" }], "Soul", exact.database as never)).resolves.toEqual({ changed: 0, unchanged: 1 });
    expect(exact.delegate.create).not.toHaveBeenCalled();

    const drift = soulDatabase({ soulId: "SOUL-1", name: "First" });
    await expect(applyGenericEntityImport([{ soulId: "SOUL-1", name: "Changed" }], "Soul", drift.database as never)).rejects.toThrow(/conflicts with authoritative persisted data/);
  });

  it("accepts an explicit canonical Species ID when its optional Taxonomy reference is null", async () => {
    const species = {
      create: vi.fn(async ({ data }) => data),
      findUnique: vi.fn().mockResolvedValue(null),
    };
    const transaction = { species };
    const database = { ...transaction, $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) };
    await expect(applyGenericEntityImport([{
      speciesId: "SPC_HOMO_SAPIENS",
      name: "Human",
      speciesKind: "HUMAN",
      scientificName: "Homo sapiens",
      taxonomyLevelId: null,
      traits: [],
      accent: null,
      anthropomorphization: null,
      appearance: null,
      clothing: null,
      architecture: null,
      originMode: "BIOLOGICAL",
      reproductiveMethod: "LIVE_BIRTH",
      juvenileStages: [],
      nurseryMode: [],
      longevityClass: "HUMAN_BASELINE",
      mortalityMode: "NORMAL",
      soulDisposition: "RETURNS_TO_WELL",
      continuityGroup: "FAMILY",
      continuityPropagationMode: "BILATERAL_DESCENT",
    }], "Species", database as never)).resolves.toEqual({ changed: 1, unchanged: 0 });
  });

  it("does not let generic Witness import bypass Architect Soul continuity", async () => {
    const witness = {
      create: vi.fn(async ({ data }) => data),
      findUnique: vi.fn().mockResolvedValue(null),
    };
    const transaction = {
      witness,
      character: { findUnique: vi.fn().mockResolvedValue({ characterId: "CHA_WITNESS", breedId: "BRD_WITNESS", soulId: "SOUL_2" }) },
      architect: { findUnique: vi.fn().mockResolvedValue({ characterId: "CHA_ARCHITECT", department: "ASTRONOMY", character: { characterId: "CHA_ARCHITECT", breedId: "BRD_ARCHITECT", soulId: "SOUL_1" } }) },
      witnessDef: { findUnique: vi.fn().mockResolvedValue({ architectSoulId: "SOUL_1", department: "ASTRONOMY", witnessDefId: "WDF_WITNESS_OF_THE_SUMMIT" }) },
    };
    const database = { ...transaction, $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) };
    await expect(applyGenericEntityImport([{
      characterId: "CHA_WITNESS",
      witnessDefId: "WDF_WITNESS_OF_THE_SUMMIT",
      architectCharacterId: "CHA_ARCHITECT",
    }], "Witness", database as never)).rejects.toThrow("Witness and source Architect must reference the same Soul.");
    expect(witness.create).not.toHaveBeenCalled();
  });

  it("rejects arbitrary null-Breed Characters through direct and batch administration", async () => {
    const character = {
      create: vi.fn(async ({ data }) => data),
      findUnique: vi.fn().mockResolvedValue(null),
    };
    const transaction = { character };
    const database = { ...transaction, $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) };
    const row = { characterId: "CHA_UNKNOWN", displayName: "Unknown", breedId: null };
    await expect(createEntityRecord(database as never, "Character", row)).rejects.toThrow(/Breed is required/);
    await expect(applyGenericEntityImport([row], "Character", database as never)).rejects.toThrow(/Breed is required/);
    expect(character.create).not.toHaveBeenCalled();
  });

  it("allows only the canonical Mother identity to use the null-Breed exception", async () => {
    const character = {
      create: vi.fn(async ({ data }) => data),
      findUnique: vi.fn().mockResolvedValue(null),
    };
    const database = { character };
    const mother = { characterId: "CHA_MOTHER", displayName: "Mother", breedId: null };
    await expect(createEntityRecord(database as never, "Character", mother)).resolves.toMatchObject(mother);
    await expect(createEntityRecord(database as never, "Character", { ...mother, breedId: "BRD_FAKE" })).rejects.toThrow(/must have breedId null/);
  });

  it("does not let subtype administration attach Architect or Companion roles to null-Breed Characters", async () => {
    const delegate = {
      create: vi.fn(async ({ data }) => data),
      findUnique: vi.fn().mockResolvedValue(null),
    };
    const database = {
      architect: delegate,
      companion: delegate,
      character: { findUnique: vi.fn().mockResolvedValue({ characterId: "CHA_NULL", breedId: null }) },
    };
    await expect(createEntityRecord(database as never, "Architect", { characterId: "CHA_NULL", department: "ASTRONOMY" })).rejects.toThrow(/Breed is required/);
    await expect(createEntityRecord(database as never, "Companion", { characterId: "CHA_NULL", companionKey: "A" })).rejects.toThrow(/Breed is required/);
    expect(delegate.create).not.toHaveBeenCalled();
  });
});
