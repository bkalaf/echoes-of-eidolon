import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { CampaignBookRangeError } from "../../../../domain/campaign-planner";
import { requireAdministration } from "../../../../server/access";
import { campaignPlacementReorderSchema, reorderCampaignPlacement } from "../../../../server/campaigns";

export const Route = createFileRoute("/api/admin/campaign/reorder")({
  server: { handlers: {
    POST: async ({ request }) => {
      try {
        await requireAdministration(request);
        return Response.json(await reorderCampaignPlacement(campaignPlacementReorderSchema.parse(await request.json())));
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof z.ZodError) return Response.json({ error: "Choose one valid Campaign placement movement." }, { status: 400 });
        if (error instanceof CampaignBookRangeError) return Response.json({ error: error.message }, { status: 400 });
        throw error;
      }
    },
  } },
});
