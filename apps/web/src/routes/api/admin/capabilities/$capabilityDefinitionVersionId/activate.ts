import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../../../server/access";
import { activateCapabilityDefinitionVersion } from "../../../../../server/capability-ledger";

export const Route = createFileRoute("/api/admin/capabilities/$capabilityDefinitionVersionId/activate")({
  server: { handlers: {
    POST: async ({ request, params }) => {
      try {
        await requireAdministration(request);
        return Response.json({ version: await activateCapabilityDefinitionVersion(params.capabilityDefinitionVersionId) });
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof Error) return Response.json({ error: error.message }, { status: 400 });
        throw error;
      }
    },
  } },
});
