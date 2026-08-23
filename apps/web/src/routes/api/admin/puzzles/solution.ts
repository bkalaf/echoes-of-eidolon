import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../server/access";
import { getAuthEnv } from "../../../../server/env";
import { productionPuzzleBlueprintIds, revealProductionPreviewSolution } from "../../../../server/puzzle-production-validation";

const revealSchema = z.object({
  generation: z.number().int().min(0).max(10_000),
  puzzleBlueprintId: z.enum(productionPuzzleBlueprintIds),
}).strict();

export const Route = createFileRoute("/api/admin/puzzles/solution")({
  server: { handlers: {
    POST: async ({ request }) => {
      try {
        await requireAdministration(request);
        const input = revealSchema.parse(await request.json());
        return Response.json(revealProductionPreviewSolution(input.puzzleBlueprintId, input.generation, getAuthEnv().BETTER_AUTH_SECRET), {
          headers: { "cache-control": "no-store, private" },
        });
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Solution reveal input is invalid." }, { status: 400 });
        return Response.json({ error: "Expected solution could not be revealed." }, { status: 500 });
      }
    },
  } },
});
