import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../../server/access";
import { completeSettlementNaming } from "../../../../server/settlements";

export const Route = createFileRoute("/api/admin/settlements/complete-naming")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAdministration(request);
          return Response.json(await completeSettlementNaming(await request.json()));
        } catch (error) {
          if (error instanceof Response) return error;
          return Response.json({ error: error instanceof Error ? error.message : "Settlement naming failed." }, { status: 400 });
        }
      },
    },
  },
});
