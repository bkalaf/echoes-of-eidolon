import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../server/access";
import { getAdminDashboard } from "../../../server/admin-dashboard";

export const Route = createFileRoute("/api/admin/dashboard")({
  server: { handlers: { GET: async ({ request }) => {
    try {
      await requireAdministration(request);
      return Response.json(await getAdminDashboard());
    } catch (error) {
      if (error instanceof Response) return error;
      return Response.json({ error: "Administrative dashboard state could not be loaded." }, { status: 500 });
    }
  } } },
});
