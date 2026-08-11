import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../../server/access";
import { publishRelease } from "../../../../../server/releases";

const publicationSchema = z.object({ gitSha: z.string().regex(/^[0-9a-f]{40}$/) }).strict();

export const Route = createFileRoute("/api/admin/releases/$id/publish")({
  server: { handlers: { POST: async ({ params, request }) => { try { await requireAdministration(request); const input = publicationSchema.parse(await request.json()); return Response.json({ release: await publishRelease({ ...input, releaseId: params.id }) }); } catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError || (error instanceof Error && /reviewed draft/.test(error.message))) return Response.json({ error: error instanceof Error ? error.message : "Invalid publication request." }, { status: 400 }); throw error; } } } },
});
