import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { WorldKey } from "../../../../generated/prisma/enums";
import { requireAdministration } from "../../../../server/access";
import { listSettlementWorlds } from "../../../../server/settlements";

const settlementQuerySchema = z.object({ world: z.enum(WorldKey) }).strict();

export const Route = createFileRoute("/api/admin/settlements/")({
  server: { handlers: { GET: async ({ request }) => {
    try {
      await requireAdministration(request);
      const url = new URL(request.url);
      const query = settlementQuerySchema.parse({ world: url.searchParams.get("world") });
      return Response.json({ settlements: await listSettlementWorlds(query.world), worldKey: query.world });
    } catch (error) {
      if (error instanceof Response) return error;
      if (error instanceof z.ZodError) return Response.json({ error: "A canonical WorldKey is required." }, { status: 400 });
      return Response.json({ error: error instanceof Error ? error.message : "Settlements could not be loaded." }, { status: 409 });
    }
  } } },
});
