import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { CampaignBookRangeError } from "../../../../domain/campaign-planner";
import { requireAdministration } from "../../../../server/access";
import { bookGroupingUpdateSchema, saveDisjointTrilogy } from "../../../../server/campaigns";

export const Route = createFileRoute("/api/admin/campaign/groupings")({
  server: { handlers: {
    PUT: async ({ request }) => {
      try {
        await requireAdministration(request);
        return Response.json({ values: await saveDisjointTrilogy(bookGroupingUpdateSchema.parse(await request.json())) });
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof z.ZodError) return Response.json({ error: "Three complete grouping values are required." }, { status: 400 });
        if (error instanceof CampaignBookRangeError) return Response.json({ error: error.message }, { status: 400 });
        throw error;
      }
    },
  } },
});
