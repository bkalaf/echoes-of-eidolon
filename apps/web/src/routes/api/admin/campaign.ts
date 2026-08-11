import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { WorldKey } from "../../../generated/prisma/enums";
import { requireAdministration } from "../../../server/access";
import { CampaignBookRangeError } from "../../../domain/campaign-planner";
import { campaignPlacementInputSchema, getCampaignWorkspace, saveCampaignPlacement } from "../../../server/campaigns";

export const Route = createFileRoute("/api/admin/campaign")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        await requireAdministration(request);
        const worldKey = z.enum(WorldKey).parse(new URL(request.url).searchParams.get("world"));
        return Response.json(await getCampaignWorkspace(worldKey));
      } catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError) return Response.json({ error: "A valid campaign world is required." }, { status: 400 }); throw error; }
    },
    POST: async ({ request }) => {
      try { await requireAdministration(request); return Response.json({ placement: await saveCampaignPlacement(campaignPlacementInputSchema.parse(await request.json())) }, { status: 201 }); }
      catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError) return Response.json({ error: "A valid campaign placement is required." }, { status: 400 }); if (error instanceof CampaignBookRangeError) return Response.json({ error: error.message }, { status: 400 }); throw error; }
    },
  } },
});
