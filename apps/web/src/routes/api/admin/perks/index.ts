import { createFileRoute } from "@tanstack/react-router";

import { requireAdminCapability } from "../../../../server/access";
import { getDatabase } from "../../../../server/database";

export const Route = createFileRoute("/api/admin/perks/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdminCapability(request, "configurePerks");
          const perks = await getDatabase().perk.findMany({
            orderBy: { perkId: "asc" },
            select: { description: true, name: true, perkId: true, status: true },
          });
          return Response.json({ perks });
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    },
  },
});
