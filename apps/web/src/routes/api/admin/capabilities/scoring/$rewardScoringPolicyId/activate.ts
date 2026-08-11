import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../../../../server/access";
import { activateRewardScoringPolicyVersion } from "../../../../../../server/capability-ledger";

export const Route = createFileRoute("/api/admin/capabilities/scoring/$rewardScoringPolicyId/activate")({
  server: { handlers: {
    POST: async ({ request, params }) => {
      try {
        await requireAdministration(request);
        return Response.json({ policy: await activateRewardScoringPolicyVersion(params.rewardScoringPolicyId) });
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof Error) return Response.json({ error: error.message }, { status: 400 });
        throw error;
      }
    },
  } },
});
