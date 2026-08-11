import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../../server/access";
import { appendPuzzleVersion, appendPuzzleVersionSchema, getPuzzleBlueprint, PuzzleAuthoringConflictError } from "../../../../../server/puzzle-authoring";

function puzzleError(error: unknown): Response {
  if (error instanceof Response) return error;
  if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Puzzle version input is invalid." }, { status: 400 });
  if (error instanceof PuzzleAuthoringConflictError) return Response.json({ error: error.message }, { status: 409 });
  return Response.json({ error: "Puzzle Blueprint operation failed." }, { status: 500 });
}

export const Route = createFileRoute("/api/admin/puzzles/blueprints/$puzzleBlueprintId")({
  server: { handlers: {
    GET: async ({ params, request }) => {
      try {
        await requireAdministration(request);
        return Response.json({ blueprint: await getPuzzleBlueprint(params.puzzleBlueprintId) });
      } catch (error) {
        return puzzleError(error);
      }
    },
    PUT: async ({ params, request }) => {
      try {
        await requireAdministration(request);
        const blueprint = await appendPuzzleVersion(params.puzzleBlueprintId, appendPuzzleVersionSchema.parse(await request.json()));
        return Response.json({ blueprint });
      } catch (error) {
        return puzzleError(error);
      }
    },
  } },
});
