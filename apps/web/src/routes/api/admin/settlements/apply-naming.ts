import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../server/access";
import { applySettlementNames } from "../../../../server/settlements";

const inputSchema = z.object({ promptTextResultId: z.string().min(1) }).strict();

export const Route = createFileRoute("/api/admin/settlements/apply-naming")({ server: { handlers: { POST: async ({ request }) => {
  try {
    await requireAdministration(request);
    const input = inputSchema.parse(await request.json());
    return Response.json(await applySettlementNames(input.promptTextResultId));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) return Response.json({ error: "A validated naming result is required." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Settlement names could not be applied." }, { status: 409 });
  }
} } } });
