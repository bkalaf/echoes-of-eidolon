import { createFileRoute } from "@tanstack/react-router";

import { projectMembershipEntitlement } from "../../../../domain/membership";
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
              membershipGrants: {
                select: {
                  effectiveEndAt: true,
                  effectiveStartAt: true,
                  revocations: { select: { effectiveEndAfter: true } },
                },
              },
            },
          });
          if (!account) return Response.json({ error: "Account not found." }, { status: 404 });
          const { id, membershipGrants, sessions, ...fields } = account;
          const membership = projectMembershipEntitlement(membershipGrants, new Date());
          return Response.json({
            account: {
              ...fields,
              membership: {
                active: membership.active,
                effectiveEndAt: membership.effectiveEndAt?.toISOString() ?? null,
              },
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
