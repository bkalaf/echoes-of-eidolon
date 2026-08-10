import { createFileRoute } from "@tanstack/react-router";

import { requireServerSession } from "../../../../server/access";
import { revokeAllOtherSessions } from "../../../../server/account-sessions";

export const Route = createFileRoute("/api/account/sessions/revoke-all-other")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const access = await requireServerSession(request);
          const revokedCount = await revokeAllOtherSessions({
            currentSessionToken: access.sessionToken,
            userId: access.userId,
          });
          return Response.json({ revokedCount });
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    },
  },
});
