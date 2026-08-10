import { createFileRoute } from "@tanstack/react-router";

import { requireAdminCapability } from "../../../../server/access";
import { getDatabase } from "../../../../server/database";

export const Route = createFileRoute("/api/admin/beta-invitations/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdminCapability(request, "reviewInvitations");
          const requests = await getDatabase().betaInviteRequest.findMany({
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              friendName: true,
              email: true,
              reason: true,
              status: true,
              createdAt: true,
              invitation: {
                select: {
                  id: true,
                  expiresAt: true,
                  revokedAt: true,
                  consumedAt: true,
                },
              },
            },
          });
          return Response.json({ requests });
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    },
  },
});
