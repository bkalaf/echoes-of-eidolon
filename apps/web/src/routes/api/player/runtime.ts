import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requirePlayerAccess } from "../../../server/access";
import { gameTurnInputSchema, getPlayerRuntime, submitGameTurn } from "../../../server/game-runtime";

export const Route = createFileRoute("/api/player/runtime")({
  server: { handlers: {
    GET: async ({ request }) => {
      try { return Response.json(await getPlayerRuntime((await requirePlayerAccess(request)).userId)); }
      catch (error) { if (error instanceof Response) return error; throw error; }
    },
    POST: async ({ request }) => {
      try {
        const access = await requirePlayerAccess(request);
        const input = gameTurnInputSchema.parse(await request.json());
        const turn = await submitGameTurn({ ...input, userId: access.userId }, undefined);
        return Response.json({ turn }, { status: turn.providerAvailable ? 201 : 503 });
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof z.ZodError) return Response.json({ error: "A nonempty text input is required." }, { status: 400 });
        throw error;
      }
    },
  } },
});
