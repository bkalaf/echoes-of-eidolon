import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";

type Database = PrismaClient;

export const documentDraftInputSchema = z.object({
  content: z.string().trim().min(1).max(200_000),
  documentBucketId: z.string().trim().min(1),
}).strict();

export async function getDocumentBuilder(database: Database = getDatabase()) {
  return database.documentBucket.findMany({
    orderBy: { name: "asc" },
    include: {
      amendments: { orderBy: { ordinal: "asc" } },
      drafts: { orderBy: { version: "desc" } },
      sourcePoints: { orderBy: { ordinal: "asc" } },
    },
  });
}

export async function createDocumentDraft(input: {
  authoredByUserId: string;
  content: string;
  documentBucketId: string;
}, database: Database = getDatabase()) {
  return database.$transaction(async (transaction) => {
    const bucket = await transaction.documentBucket.findUnique({
      where: { documentBucketId: input.documentBucketId },
      include: { amendments: { orderBy: { ordinal: "asc" } }, sourcePoints: { orderBy: { ordinal: "asc" } }, drafts: { select: { version: true }, orderBy: { version: "desc" }, take: 1 } },
    });
    if (!bucket || bucket.sourcePoints.length === 0) throw new Error("A document bucket with authoritative source points is required.");
    return transaction.documentDraft.create({
      data: {
        amendmentIds: bucket.amendments.map((item) => item.documentAmendmentId),
        authoredByUserId: input.authoredByUserId,
        content: input.content,
        documentBucketId: bucket.documentBucketId,
        documentDraftId: randomUUID(),
        sourcePointIds: bucket.sourcePoints.map((item) => item.documentSourcePointId),
        version: (bucket.drafts[0]?.version ?? 0) + 1,
      },
    });
  }, { isolationLevel: "Serializable" });
}
