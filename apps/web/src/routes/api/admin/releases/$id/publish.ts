import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../../../server/access";

export const Route = createFileRoute("/api/admin/releases/$id/publish")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      await requireAdministration(request);
      return Response.json({ error: "Release publication requires an owner-reviewed canonical repository change." }, { status: 409 });
    } catch (error) {
      if (error instanceof Response) return error;
      throw error;
    }
  } } },
});
