import { randomUUID } from "node:crypto";
import { z } from "zod";

import { PromptFamily, PromptStatus } from "../generated/prisma/enums";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";
import { composeWitnessImagePrompt, witnessCanonicalVisualFields } from "./witness-image-prompt";

const requiredText = (label: string, maximum: number) => z.string().trim().min(1, `${label} is required.`).max(maximum, `${label} is too long.`);

export const promptRecordCreateSchema = z.object({
  family: z.enum(PromptFamily),
  promptText: requiredText("Prompt text", 100_000),
  purpose: requiredText("Purpose", 500),
  responseContract: z.json(),
  status: z.enum(PromptStatus),
  targetId: requiredText("Target identifier", 500),
  targetType: requiredText("Target type", 200),
  requiredCanonicalVisualFields: z.array(z.enum(witnessCanonicalVisualFields)).default([]),
}).strict();

export const promptVersionAppendSchema = z.object({
  promptText: requiredText("Prompt text", 100_000),
  responseContract: z.json(),
  requiredCanonicalVisualFields: z.array(z.enum(witnessCanonicalVisualFields)).default([]),
}).strict();

export const promptResultAssociationSchema = z.object({
  generatedManagedAssetId: requiredText("Managed asset identifier", 500),
  promptVersionId: requiredText("Prompt version identifier", 500),
}).strict();

const promptSelection = {
  family: true,
  promptRecordId: true,
  purpose: true,
  status: true,
  targetId: true,
  targetType: true,
  versions: {
    orderBy: { version: "desc" as const },
    select: {
      createdAt: true,
      generatedManagedAssetId: true,
      promptText: true,
      promptVersionId: true,
      responseContract: true,
      version: true,
    },
  },
} satisfies Prisma.PromptRecordSelect;

export class PromptAuthoringConflictError extends Error {}

async function canonicalPromptText(input: { family: string; promptText: string; targetId: string; targetType: string; requiredCanonicalVisualFields: Array<(typeof witnessCanonicalVisualFields)[number]> }, database: Pick<PrismaClient, "witness">): Promise<string> {
  if (input.family !== "IMAGE" || input.targetType !== "Witness") return input.promptText;
  return composeWitnessImagePrompt(input.targetId, input.promptText, input.requiredCanonicalVisualFields, database);
}

export async function getPromptRecord(promptRecordId: string, database: PrismaClient = getDatabase()) {
  const prompt = await database.promptRecord.findUnique({ where: { promptRecordId }, select: promptSelection });
  if (!prompt) throw new PromptAuthoringConflictError("Prompt record was not found.");
  return prompt;
}

export async function createPromptRecord(input: z.infer<typeof promptRecordCreateSchema>, database: PrismaClient = getDatabase()) {
  const promptRecordId = randomUUID();
  const promptText = await canonicalPromptText(input, database);
  await database.promptRecord.create({
    data: {
      family: input.family,
      promptRecordId,
      purpose: input.purpose,
      status: input.status,
      targetId: input.targetId,
      targetType: input.targetType,
      versions: {
        create: {
          promptText,
          promptVersionId: randomUUID(),
          responseContract: input.responseContract as Prisma.InputJsonValue,
          version: 1,
        },
      },
    },
  });
  return getPromptRecord(promptRecordId, database);
}

export async function appendPromptVersion(promptRecordId: string, input: z.infer<typeof promptVersionAppendSchema>, database: PrismaClient = getDatabase()) {
  await database.$transaction(async (transaction) => {
    const prompt = await transaction.promptRecord.findUnique({
      where: { promptRecordId },
      select: { family: true, targetId: true, targetType: true, versions: { orderBy: { version: "desc" }, select: { version: true }, take: 1 } },
    });
    if (!prompt) throw new PromptAuthoringConflictError("Prompt record was not found.");
    const promptText = await canonicalPromptText({ ...input, family: prompt.family, targetId: prompt.targetId, targetType: prompt.targetType }, transaction as unknown as PrismaClient);
    await transaction.promptVersion.create({
      data: {
        promptRecordId,
        promptText,
        promptVersionId: randomUUID(),
        responseContract: input.responseContract as Prisma.InputJsonValue,
        version: (prompt.versions[0]?.version ?? 0) + 1,
      },
    });
  });
  return getPromptRecord(promptRecordId, database);
}

export async function associatePromptResult(promptRecordId: string, input: z.infer<typeof promptResultAssociationSchema>, database: PrismaClient = getDatabase()) {
  await database.$transaction(async (transaction) => {
    const [prompt, asset] = await Promise.all([
      transaction.promptRecord.findUnique({
        where: { promptRecordId },
        select: { family: true, versions: { where: { promptVersionId: input.promptVersionId }, select: { promptVersionId: true } } },
      }),
      transaction.managedAsset.findUnique({ where: { managedAssetId: input.generatedManagedAssetId }, select: { managedAssetId: true, mediaKind: true } }),
    ]);
    if (!prompt) throw new PromptAuthoringConflictError("Prompt record was not found.");
    if (prompt.versions.length !== 1) throw new PromptAuthoringConflictError("Prompt version does not belong to this prompt record.");
    if (!asset) throw new PromptAuthoringConflictError("Managed result asset was not found.");
    const expectedKind = prompt.family === "IMAGE" ? "IMAGE" : prompt.family === "MUSIC" ? "AUDIO" : undefined;
    if (!expectedKind) throw new PromptAuthoringConflictError(`${prompt.family} prompts have no persisted managed-asset result contract.`);
    if (asset.mediaKind !== expectedKind) throw new PromptAuthoringConflictError(`${prompt.family} prompt results require a ${expectedKind} managed asset.`);
    await transaction.promptVersion.update({
      where: { promptVersionId: input.promptVersionId },
      data: { generatedManagedAssetId: asset.managedAssetId },
    });
    await transaction.promptRecord.update({ where: { promptRecordId }, data: { status: "COMPLETED" } });
  });
  return getPromptRecord(promptRecordId, database);
}
