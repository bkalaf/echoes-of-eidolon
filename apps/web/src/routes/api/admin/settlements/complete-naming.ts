import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../../server/access";
import { validateSettlementNaming } from "../../../../server/settlements";

export const Route = createFileRoute("/api/admin/settlements/complete-naming")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAdministration(request);
          return Response.json(await validateSettlementNaming(await request.json()));
        } catch (error) {
          if (error instanceof Response) return error;
          return Response.json({ error: error instanceof Error ? error.message : "Settlement naming validation failed." }, { status: 400 });
        }
      },
    },
  },
});
