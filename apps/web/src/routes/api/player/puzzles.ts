import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requirePlayerAccess } from "../../../server/access";
import { acceptPlayerPuzzleChallenge, getPlayerPuzzleChallenges } from "../../../server/player-puzzles";

export const playerPuzzleAcceptanceSchema = z.object({
  generatorVersion: z.number().int().min(0),
  puzzleBlueprintId: z.string().trim().min(1),
}).strict();

export const Route = createFileRoute("/api/player/puzzles")({
  server: { handlers: {
    GET: async ({ request }) => {
      try { return Response.json(await getPlayerPuzzleChallenges((await requirePlayerAccess(request)).userId)); }
      catch (error) { if (error instanceof Response) return error; throw error; }
    },
    POST: async ({ request }) => {
      try {
        const access = await requirePlayerAccess(request);
        return Response.json(await acceptPlayerPuzzleChallenge({ ...playerPuzzleAcceptanceSchema.parse(await request.json()), userId: access.userId }), { status: 201 });
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof z.ZodError) return Response.json({ error: "Puzzle acceptance input is invalid." }, { status: 400 });
        return Response.json({ error: error instanceof Error ? error.message : "Puzzle acceptance failed." }, { status: 400 });
      }
    },
  } },
});
