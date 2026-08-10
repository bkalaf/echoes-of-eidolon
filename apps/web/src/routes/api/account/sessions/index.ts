import { createFileRoute } from "@tanstack/react-router";

import { requireServerSession } from "../../../../server/access";
import { listAccountSessions } from "../../../../server/account-sessions";

export const Route = createFileRoute("/api/account/sessions/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const access = await requireServerSession(request);
          const sessions = await listAccountSessions({
            currentSessionToken: access.sessionToken,
            userId: access.userId,
          });
          return Response.json({ sessions });
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    },
  },
});
