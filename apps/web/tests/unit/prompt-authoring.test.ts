import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { appendPromptVersion, associatePromptResult, createPromptRecord, PromptAuthoringConflictError } from "../../src/server/prompt-authoring";

function transactionDatabase(transaction: object, finalPrompt: object) {
  return {
    $transaction: vi.fn(async (operation: (value: object) => unknown) => operation(transaction)),
    promptRecord: { findUnique: vi.fn().mockResolvedValue(finalPrompt) },
  } as unknown as PrismaClient;
}

describe("prompt authoring", () => {
  it("creates a prompt with an immutable version 1 and explicit response contract", async () => {
    const create = vi.fn().mockResolvedValue({});
    const finalPrompt = { promptRecordId: "PROMPT-1", versions: [{ version: 1 }] };
    const database = { promptRecord: { create, findUnique: vi.fn().mockResolvedValue(finalPrompt) } } as unknown as PrismaClient;
    await expect(createPromptRecord({
      family: "IMAGE",
      promptText: "Owner authored prompt",
      purpose: "feature artwork",
      responseContract: { type: "object" },
      status: "OUTSTANDING",
      targetId: "FEATURE-1",
      targetType: "Feature",
    }, database)).resolves.toBe(finalPrompt);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      family: "IMAGE",
      versions: { create: expect.objectContaining({ promptText: "Owner authored prompt", responseContract: { type: "object" }, version: 1 }) },
    }) });
  });

  it("appends the next version without rewriting history", async () => {
    const create = vi.fn().mockResolvedValue({});
    const transaction = {
      promptRecord: { findUnique: vi.fn().mockResolvedValue({ versions: [{ version: 3 }] }) },
      promptVersion: { create },
    };
    const database = transactionDatabase(transaction, { promptRecordId: "PROMPT-1", versions: [{ version: 4 }] });
    await appendPromptVersion("PROMPT-1", { promptText: "Revision", responseContract: { type: "string" } }, database);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ promptRecordId: "PROMPT-1", version: 4 }) });
    expect(transaction).not.toHaveProperty("promptVersion.updateMany");
  });

  it("associates only media-compatible managed results and completes the record", async () => {
    const updateVersion = vi.fn().mockResolvedValue({});
    const updatePrompt = vi.fn().mockResolvedValue({});
    const transaction = {
      managedAsset: { findUnique: vi.fn().mockResolvedValue({ managedAssetId: "ASSET-1", mediaKind: "AUDIO" }) },
      promptRecord: {
        findUnique: vi.fn().mockResolvedValue({ family: "MUSIC", versions: [{ promptVersionId: "VERSION-1" }] }),
        update: updatePrompt,
      },
      promptVersion: { update: updateVersion },
    };
    const database = transactionDatabase(transaction, { promptRecordId: "PROMPT-1", status: "COMPLETED" });
    await associatePromptResult("PROMPT-1", { generatedManagedAssetId: "ASSET-1", promptVersionId: "VERSION-1" }, database);
    expect(updateVersion).toHaveBeenCalledWith({ where: { promptVersionId: "VERSION-1" }, data: { generatedManagedAssetId: "ASSET-1" } });
    expect(updatePrompt).toHaveBeenCalledWith({ where: { promptRecordId: "PROMPT-1" }, data: { status: "COMPLETED" } });
  });

  it("refuses to invent a managed-asset result contract for naming prompts", async () => {
    const transaction = {
      managedAsset: { findUnique: vi.fn().mockResolvedValue({ managedAssetId: "ASSET-1", mediaKind: "AUDIO" }) },
      promptRecord: { findUnique: vi.fn().mockResolvedValue({ family: "NAMING", versions: [{ promptVersionId: "VERSION-1" }] }) },
    };
    const database = transactionDatabase(transaction, {});
    await expect(associatePromptResult("PROMPT-1", { generatedManagedAssetId: "ASSET-1", promptVersionId: "VERSION-1" }, database)).rejects.toThrow(PromptAuthoringConflictError);
  });
});
