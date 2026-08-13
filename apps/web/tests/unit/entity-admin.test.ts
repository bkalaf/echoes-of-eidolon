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
    expect(normalizeEntityData("Species", { speciesId: "SP-1", name: "Otter", speciesKind: "BEAST", scientificName: "", taxonomy: { family: "Mustelidae" }, appearance: ["brown"], anthropomorphization: [] }, "create")).toMatchObject({ scientificName: null, appearance: ["brown"], taxonomy: { family: "Mustelidae" } });
    expect(() => normalizeEntityData("Soul", { soulId: "S-1", name: "Soul", invented: true }, "create")).toThrow(EntityAdminValidationError);
  });

  it("lists, reads, creates, and updates through the exact allowlisted delegate", async () => {
    const existing = { soulId: "SOUL-1", name: "First" };
    const { database, delegate } = soulDatabase(existing);
    await expect(listEntityRecords(database as never, "Soul")).resolves.toEqual([existing]);
    await expect(getEntityRecord(database as never, "Soul", "SOUL-1")).resolves.toEqual(existing);
    await expect(createEntityRecord(database as never, "Soul", { soulId: "SOUL-2", name: "Second" })).resolves.toEqual({ soulId: "SOUL-2", name: "Second" });
    await expect(updateEntityRecord(database as never, "Soul", "SOUL-1", { soulId: "SOUL-1", name: "Renamed" })).resolves.toEqual({ soulId: "SOUL-1", name: "Renamed" });
    expect(delegate.findMany).toHaveBeenCalledWith({ orderBy: { soulId: "asc" }, take: 500 });
    expect(delegate.update).toHaveBeenCalledWith({ data: { name: "Renamed" }, where: { soulId: "SOUL-1" } });
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
});
