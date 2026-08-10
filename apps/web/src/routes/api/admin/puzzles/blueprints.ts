import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../../server/access";
import { getDatabase } from "../../../../server/database";

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
              family: true,
              puzzleBlueprintId: true,
              versions: {
                orderBy: { generatorVersion: "desc" },
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
    },
  },
});
