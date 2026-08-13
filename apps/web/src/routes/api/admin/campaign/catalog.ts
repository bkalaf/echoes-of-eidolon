import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../server/access";
import { CampaignBookRangeError } from "../../../../domain/campaign-planner";
import { campaignCatalogCreateSchema, createCampaignCatalogItem } from "../../../../server/campaigns";

export const Route = createFileRoute("/api/admin/campaign/catalog")({ server: { handlers: {
  POST: async ({ request }) => {
    try { await requireAdministration(request); return Response.json({ record: await createCampaignCatalogItem(campaignCatalogCreateSchema.parse(await request.json())) }, { status: 201 }); }
    catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError || error instanceof CampaignBookRangeError) return Response.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : error.message }, { status: 400 }); throw error; }
  },
} } });
