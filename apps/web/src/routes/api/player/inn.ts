import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requirePlayerAccess } from "../../../server/access";
import { applyCurrentInnService } from "../../../server/player-gameplay";

const inputSchema = z.object({ action: z.enum(["STAY", "EAT"]) }).strict();

export const Route = createFileRoute("/api/player/inn")({ server: { handlers: { POST: async ({ request }) => {
  try { const access = await requirePlayerAccess(request); const input = inputSchema.parse(await request.json()); return Response.json(await applyCurrentInnService(access.userId, input.action)); }
  catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Inn action is invalid." }, { status: 400 }); return Response.json({ error: error instanceof Error ? error.message : "Inn action failed." }, { status: 409 }); }
} } } });
