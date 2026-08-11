import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../server/access";
import { listAdministrativeReleases } from "../../../server/releases";

export const Route = createFileRoute("/api/admin/releases")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        await requireAdministration(request);
        return Response.json({ releases: await listAdministrativeReleases() });
      } catch (error) {
        if (error instanceof Response) return error;
        throw error;
      }
    },
    POST: async ({ request }) => {
      try {
        await requireAdministration(request);
        return Response.json({ error: "Canonical release drafts are reviewed in the repository and cannot be created at runtime." }, { status: 409 });
      } catch (error) {
        if (error instanceof Response) return error;
        throw error;
      }
    },
  } },
});
