import { createFileRoute } from "@tanstack/react-router";

import { requireAdminCapability } from "../../../../../server/access";
import { rejectBetaInviteRequest } from "../../../../../server/beta-invitations";

export const Route = createFileRoute("/api/admin/beta-invitations/$id/reject")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        try {
          await requireAdminCapability(request, "reviewInvitations");
          await rejectBetaInviteRequest(params.id);
          return Response.json({ rejected: true });
        } catch (error) {
          if (error instanceof Response) return error;
          return Response.json({ error: error instanceof Error ? error.message : "Invitation request could not be rejected." }, { status: 400 });
        }
      },
    },
  },
});
