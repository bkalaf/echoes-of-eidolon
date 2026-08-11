import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PromptStatus } from "../../../../generated/prisma/enums";
import { requireAdministration } from "../../../../server/access";
import { getDatabase } from "../../../../server/database";
import { createPromptRecord, PromptAuthoringConflictError, promptRecordCreateSchema } from "../../../../server/prompt-authoring";

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
                  responseContract: true,
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
      POST: async ({ request }) => {
        try {
          await requireAdministration(request);
          const prompt = await createPromptRecord(promptRecordCreateSchema.parse(await request.json()));
          return Response.json({ prompt }, { status: 201 });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Prompt input is invalid." }, { status: 400 });
          if (error instanceof PromptAuthoringConflictError) return Response.json({ error: error.message }, { status: 409 });
          return Response.json({ error: "Prompt record could not be created." }, { status: 500 });
        }
      },
    },
  },
});
