import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../../server/access";
import { getDatabase } from "../../../../server/database";
import { createPuzzleBlueprint, createPuzzleBlueprintSchema, PuzzleAuthoringConflictError } from "../../../../server/puzzle-authoring";
import { z } from "zod";

export const Route = createFileRoute("/api/admin/puzzles/blueprints")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdministration(request);
          const blueprints = await getDatabase().puzzleBlueprint.findMany({
            orderBy: { puzzleBlueprintId: "asc" },
            select: {
              difficultyTier: true,
              primaryFamily: true,
              title: true,
              puzzleBlueprintId: true,
              versions: {
                orderBy: { createdAt: "desc" },
                select: {
                  createdAt: true,
                  generatorVersion: true,
                  hints: {
                    orderBy: { level: "asc" },
                    select: { kind: true, level: true, template: true },
                  },
                },
              },
            },
          });
          return Response.json({ blueprints, total: blueprints.length });
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
      POST: async ({ request }) => {
        try {
          await requireAdministration(request);
          const blueprint = await createPuzzleBlueprint(createPuzzleBlueprintSchema.parse(await request.json()));
          return Response.json({ blueprint }, { status: 201 });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Puzzle Blueprint input is invalid." }, { status: 400 });
          if (error instanceof PuzzleAuthoringConflictError) return Response.json({ error: error.message }, { status: 409 });
          return Response.json({ error: "Puzzle Blueprint creation failed." }, { status: 500 });
        }
      },
    },
  },
});
