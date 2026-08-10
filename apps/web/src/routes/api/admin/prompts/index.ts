import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PromptStatus } from "../../../../generated/prisma/enums";
import { requireAdministration } from "../../../../server/access";
import { getDatabase } from "../../../../server/database";

const promptStatusSchema = z.enum(PromptStatus);

export const Route = createFileRoute("/api/admin/prompts/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdministration(request);
          const value = new URL(request.url).searchParams.get("status");
          const status = value == null ? undefined : promptStatusSchema.parse(value);
          const prompts = await getDatabase().promptRecord.findMany({
            where: status ? { status } : undefined,
            orderBy: { promptRecordId: "asc" },
            select: {
              family: true,
              promptRecordId: true,
              purpose: true,
              status: true,
              targetId: true,
              targetType: true,
              versions: {
                orderBy: { version: "desc" },
                select: {
                  createdAt: true,
                  generatedManagedAssetId: true,
                  promptText: true,
                  promptVersionId: true,
                  version: true,
                },
              },
            },
          });
          return Response.json({ prompts, total: prompts.length });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: "Unknown prompt status." }, { status: 400 });
          throw error;
        }
      },
    },
  },
});
