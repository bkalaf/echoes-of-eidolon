import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../server/access";
import { puzzlePreviewIdentitySchema, PuzzleAuthoringConflictError, validatePuzzlePreviewIdentity } from "../../../../server/puzzle-authoring";

export const Route = createFileRoute("/api/admin/puzzles/preview")({
  server: { handlers: {
    POST: async ({ request }) => {
      try {
        await requireAdministration(request);
        return Response.json(await validatePuzzlePreviewIdentity(puzzlePreviewIdentitySchema.parse(await request.json())));
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Preview identity input is invalid." }, { status: 400 });
        if (error instanceof PuzzleAuthoringConflictError) return Response.json({ error: error.message }, { status: 409 });
        return Response.json({ error: "Preview identity validation failed." }, { status: 500 });
      }
    },
  } },
});
