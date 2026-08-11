import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../server/access";
import { createReleaseDraft, listAdministrativeReleases, releaseDraftInputSchema } from "../../../server/releases";

export const Route = createFileRoute("/api/admin/releases")({
  server: { handlers: {
    GET: async ({ request }) => { try { await requireAdministration(request); return Response.json({ releases: await listAdministrativeReleases() }); } catch (error) { if (error instanceof Response) return error; throw error; } },
    POST: async ({ request }) => { try { await requireAdministration(request); return Response.json({ release: await createReleaseDraft(releaseDraftInputSchema.parse(await request.json())) }, { status: 201 }); } catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError) return Response.json({ error: "Valid release metadata and a full Git SHA are required." }, { status: 400 }); throw error; } },
  } },
});
