import { createFileRoute } from "@tanstack/react-router";
import { requireAdministration } from "../../../../server/access";
import { listCapabilityScoringPolicies } from "../../../../server/capability-ledger";

export const Route = createFileRoute("/api/admin/capabilities/scoring")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        await requireAdministration(request);
        return Response.json(await listCapabilityScoringPolicies());
      } catch (error) {
        if (error instanceof Response) return error;
        throw error;
      }
    },
  } },
});
