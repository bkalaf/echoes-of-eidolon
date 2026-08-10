import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../../server/access";
import { getDatabase } from "../../../../server/database";

export const Route = createFileRoute("/api/admin/accounts/$userId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          await requireAdministration(request);
          const account = await getDatabase().user.findUnique({
            where: { id: params.userId },
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              emailVerified: true,
              eligibilityStatus: true,
              betaEligible: true,
              role: true,
              banned: true,
              banReason: true,
              banExpires: true,
              createdAt: true,
              updatedAt: true,
              sessions: {
                orderBy: { updatedAt: "desc" },
                select: {
                  id: true,
                  createdAt: true,
                  updatedAt: true,
                  expiresAt: true,
                  ipAddress: true,
                  userAgent: true,
                },
              },
            },
          });
          if (!account) return Response.json({ error: "Account not found." }, { status: 404 });
          const { id, sessions, ...fields } = account;
          return Response.json({
            account: {
              ...fields,
              userId: id,
              sessions: sessions.map(({ id: sessionId, ...session }) => ({ ...session, sessionId })),
            },
          });
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    },
  },
});
