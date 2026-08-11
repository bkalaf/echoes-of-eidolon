import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { CampaignBookRangeError } from "../../../../domain/campaign-planner";
import { requireAdministration } from "../../../../server/access";
import { linkedCampaignPlacementInputSchema, saveLinkedCampaignPlacements } from "../../../../server/campaigns";

export const Route = createFileRoute("/api/admin/campaign/linked-move")({
  server: { handlers: {
    POST: async ({ request }) => {
      try {
        await requireAdministration(request);
        return Response.json({ placements: await saveLinkedCampaignPlacements(linkedCampaignPlacementInputSchema.parse(await request.json())) }, { status: 201 });
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof z.ZodError) return Response.json({ error: "A complete linked campaign move is required." }, { status: 400 });
        if (error instanceof CampaignBookRangeError) return Response.json({ error: error.message }, { status: 400 });
        throw error;
      }
    },
  } },
});
