import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requirePlayerAccess } from "../../../server/access";
import { withdrawFromCurrentBank } from "../../../server/player-gameplay";

const inputSchema = z.object({ amount: z.number().int().positive() }).strict();

export const Route = createFileRoute("/api/player/bank-withdraw")({ server: { handlers: { POST: async ({ request }) => {
  try {
    const access = await requirePlayerAccess(request);
    const input = inputSchema.parse(await request.json());
    return Response.json(await withdrawFromCurrentBank(access.userId, input.amount));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "A positive whole-unit amount is required." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "The withdrawal failed." }, { status: 409 });
  }
} } } });
