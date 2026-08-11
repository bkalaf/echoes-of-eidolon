import type { PrismaClient } from "../generated/prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDatabase } from "./database";

type Database = PrismaClient;

export const releaseDraftInputSchema = z.object({
  audience: z.enum(["PLAYERS", "OPERATORS", "BOTH"]),
  gitSha: z.string().regex(/^[0-9a-f]{40}$/),
  notes: z.array(z.object({ category: z.enum(["ADDED", "CHANGED", "FIXED", "SECURITY", "KNOWN_ISSUE"]), content: z.string().trim().min(1).max(5_000) }).strict()).max(200),
  summary: z.string().trim().min(1).max(10_000),
  version: z.string().trim().min(1).max(100),
}).strict();

export interface PublicRelease {
  gitSha: string;
  publishedAt: string;
  releaseId: string;
  summary: string;
  version: string;
  notes: Array<{ category: string; content: string; ordinal: number }>;
}

export async function listPublicReleases(database: Database = getDatabase()): Promise<PublicRelease[]> {
  const releases = await database.release.findMany({
    where: { status: "PUBLISHED", audience: { in: ["PLAYERS", "BOTH"] } },
    include: { notes: { orderBy: [{ category: "asc" }, { ordinal: "asc" }] } },
    orderBy: { publishedAt: "desc" },
  });
  return releases.map((release) => ({
    gitSha: release.gitSha,
    publishedAt: release.publishedAt!.toISOString(),
    releaseId: release.releaseId,
    summary: release.summary,
    version: release.version,
    notes: release.notes.map(({ category, content, ordinal }) => ({ category, content, ordinal })),
  }));
}

export function getBuildIdentity() {
  const gitSha = process.env.EIDOLON_GIT_SHA;
  return {
    gitSha: gitSha && /^[0-9a-f]{40}$/.test(gitSha) ? gitSha : null,
    version: process.env.EIDOLON_VERSION ?? "0.0.0",
  };
}

export async function listAdministrativeReleases(database: Database = getDatabase()) {
  return database.release.findMany({ include: { notes: { orderBy: [{ category: "asc" }, { ordinal: "asc" }] }, deployments: { orderBy: { startedAt: "desc" } } }, orderBy: { createdAt: "desc" } });
}

export async function createReleaseDraft(input: z.infer<typeof releaseDraftInputSchema>, database: Database = getDatabase()) {
  const releaseId = randomUUID();
  return database.release.create({
    data: {
      audience: input.audience,
      gitSha: input.gitSha,
      releaseId,
      status: "DRAFT",
      summary: input.summary,
      version: input.version,
      notes: { create: input.notes.map((note, ordinal) => ({ ...note, ordinal: ordinal + 1, releaseNoteItemId: randomUUID() })) },
    },
    include: { notes: true },
  });
}

export async function publishRelease(input: { gitSha: string; releaseId: string }, database: Database = getDatabase()) {
  if (!/^[0-9a-f]{40}$/.test(input.gitSha)) throw new Error("A full Git SHA is required.");
  return database.$transaction(async (transaction) => {
    const release = await transaction.release.findUnique({ where: { releaseId: input.releaseId } });
    if (!release || release.status !== "DRAFT" || release.gitSha !== input.gitSha) throw new Error("Only the matching reviewed draft may be published.");
    await transaction.release.updateMany({ where: { status: "PUBLISHED", audience: release.audience }, data: { status: "SUPERSEDED" } });
    return transaction.release.update({ where: { releaseId: release.releaseId }, data: { publishedAt: new Date(), status: "PUBLISHED" } });
  }, { isolationLevel: "Serializable" });
}
