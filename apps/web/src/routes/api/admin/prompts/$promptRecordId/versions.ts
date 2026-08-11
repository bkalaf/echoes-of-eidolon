import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../../server/access";
import { appendPromptVersion, PromptAuthoringConflictError, promptVersionAppendSchema } from "../../../../../server/prompt-authoring";

export const Route = createFileRoute("/api/admin/prompts/$promptRecordId/versions")({
  server: { handlers: { POST: async ({ params, request }) => {
    try {
      await requireAdministration(request);
      return Response.json({ prompt: await appendPromptVersion(params.promptRecordId, promptVersionAppendSchema.parse(await request.json())) });
    } catch (error) {
      if (error instanceof Response) return error;
      if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Prompt version input is invalid." }, { status: 400 });
      if (error instanceof PromptAuthoringConflictError) return Response.json({ error: error.message }, { status: 409 });
      return Response.json({ error: "Prompt version could not be appended." }, { status: 500 });
    }
  } } },
});
