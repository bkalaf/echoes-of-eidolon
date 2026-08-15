import { describe, expect, it, vi } from "vitest";

import { decideBulkEnvelope, queueBulkMutation, worldbuildingDryRun } from "../../src/server/bulk-gateway";
import type { PrismaClient } from "../../src/generated/prisma/client";

const request = {
  operation: "INSERT" as const,
  payload: { entity: "occupation" as const, notes: "Authored import", records: [{ attributeAffinity: ["WISDOM" as const], key: "SCHOLAR", name: "Scholar" }], version: "1" as const },
};

describe("bulk gateway persistence service", () => {
  it("queues and dry-runs a mutation without changing domain data", async () => {
    const occupationCreate = vi.fn();
    const envelopeCreate = vi.fn().mockResolvedValue({ bulkMutationEnvelopeId: "ENV", sequence: 7n });
    const envelopeUpdate = vi.fn().mockResolvedValue({ bulkMutationEnvelopeId: "ENV", entityCode: "occupation", recordCount: 1, sequence: 7n, status: "PENDING_REVIEW" });
    const database = {
      bulkMutationEnvelope: { create: envelopeCreate, update: envelopeUpdate },
      bulkOperationAudit: { create: vi.fn().mockResolvedValue({}) },
      occupation: { create: occupationCreate, findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    await expect(queueBulkMutation(request, { externalBulkApiSessionId: "SESSION" }, database)).resolves.toMatchObject({ applied: false, sequence: 7, status: "PENDING_REVIEW" });
    expect(occupationCreate).not.toHaveBeenCalled();
    expect(envelopeCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "DRY_RUN_RUNNING" }) });
  });

  it("applies only the head envelope atomically after current-state revalidation", async () => {
    const head = { bulkMutationEnvelopeId: "ENV-1", entityCode: "occupation", operation: "CREATE", payload: request.payload, recordCount: 1, sequence: 1n, status: "PENDING_REVIEW" };
    const occupationCreate = vi.fn().mockResolvedValue({});
    const update = vi.fn().mockImplementation(({ data }: { data: { status: string } }) => Promise.resolve({ ...head, ...data }));
    const transaction = {
      bulkMutationEnvelope: { findFirst: vi.fn().mockResolvedValue(head), update },
      bulkOperationAudit: { create: vi.fn().mockResolvedValue({}) },
      occupation: { create: occupationCreate, findMany: vi.fn().mockResolvedValue([]) },
    };
    const database = { $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction)) } as unknown as PrismaClient;
    await expect(decideBulkEnvelope("ENV-1", "owner", "APPLY", database)).resolves.toMatchObject({ status: "APPLIED" });
    expect(occupationCreate).toHaveBeenCalledTimes(1);
    expect(update.mock.calls.map((call) => call[0].data.status)).toEqual(["APPLYING", "APPLIED"]);
    await expect(decideBulkEnvelope("ENV-2", "owner", "APPLY", database)).rejects.toThrow("earliest non-terminal");
  });

  it("keeps apply-time conflicts write-free and reviewable", async () => {
    const head = { bulkMutationEnvelopeId: "ENV-1", entityCode: "occupation", operation: "CREATE", payload: request.payload, recordCount: 1, sequence: 1n, status: "PENDING_REVIEW" };
    const occupationCreate = vi.fn();
    const update = vi.fn().mockImplementation(({ data }: { data: { status: string } }) => Promise.resolve({ ...head, ...data }));
    const transaction = {
      bulkMutationEnvelope: { findFirst: vi.fn().mockResolvedValue(head), update },
      bulkOperationAudit: { create: vi.fn() },
      occupation: { create: occupationCreate, findMany: vi.fn().mockResolvedValue([{ occupationId: "SCHOLAR" }]) },
    };
    const database = { $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction)) } as unknown as PrismaClient;
    await expect(decideBulkEnvelope("ENV-1", "owner", "APPLY", database)).resolves.toMatchObject({ status: "REVALIDATION_FAILED" });
    expect(occupationCreate).not.toHaveBeenCalled();
  });

  it("resolves Breed dependencies against already-persisted Species and Cultures during dry-run", async () => {
    const database = {
      personalityExpression: { findMany: vi.fn().mockResolvedValue([{ personalityId: "PERSONALITY" }]) },
      species: { findMany: vi.fn().mockResolvedValue([{ speciesId: "SPC_PERSISTED", speciesKind: "BEAST" }]) },
      culture: { findMany: vi.fn().mockResolvedValue([{ cultureId: "CLT_PERSISTED" }]) },
    } as unknown as PrismaClient;
    const envelope = {
      entity: "worldbuilding-research",
      schemaVersion: "eidolon-worldbuilding-research-v3-simple",
      records: [{
        recordKey: "local:breed:new",
        kind: "BREED",
        breedRef: "BRD_NEW_BREED",
        speciesRef: "SPC_PERSISTED",
        cultureRef: "CLT_PERSISTED",
        researchStatus: "RESOLVED",
        importStatus: "RESEARCH_COMPLETE_IMPORTABLE",
        data: { breedId: "BRD_NEW_BREED", name: "New Breed", groupId: "B01", personalityId: "PERSONALITY", foodBroad: [], foodSpecific: [], terrainBroad: [], terrainSpecific: [] },
      }],
    };
    await expect(worldbuildingDryRun(envelope, database)).resolves.toMatchObject({
      valid: true,
      importableClosure: ["BRD_NEW_BREED"],
      idMap: { SPC_PERSISTED: "SPC_PERSISTED", CLT_PERSISTED: "CLT_PERSISTED", BRD_NEW_BREED: "BRD_NEW_BREED" },
    });
  });
});
