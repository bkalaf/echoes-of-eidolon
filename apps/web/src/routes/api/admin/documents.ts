import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../server/access";
import { createDocumentDraft, documentDraftInputSchema, getDocumentBuilder } from "../../../server/documents";

export const Route = createFileRoute("/api/admin/documents")({
  server: { handlers: {
    GET: async ({ request }) => { try { await requireAdministration(request); return Response.json({ buckets: await getDocumentBuilder() }); } catch (error) { if (error instanceof Response) return error; throw error; } },
    POST: async ({ request }) => { try { const access = await requireAdministration(request); const input = documentDraftInputSchema.parse(await request.json()); return Response.json({ draft: await createDocumentDraft({ ...input, authoredByUserId: access.userId }) }, { status: 201 }); } catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError) return Response.json({ error: "A document bucket and generated draft content are required." }, { status: 400 }); if (error instanceof Error && /source points/.test(error.message)) return Response.json({ error: error.message }, { status: 400 }); throw error; } },
  } },
});
