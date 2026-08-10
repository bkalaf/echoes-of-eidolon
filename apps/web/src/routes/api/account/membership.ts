import { createFileRoute } from "@tanstack/react-router";

import { activePerks, projectMembershipEntitlement, voiceWindowSeconds } from "../../../domain/membership";
import { requireServerSession } from "../../../server/access";
import { getDatabase } from "../../../server/database";

export const Route = createFileRoute("/api/account/membership")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const access = await requireServerSession(request);
          const [grants, perks] = await Promise.all([
            getDatabase().membershipGrant.findMany({
              where: { userId: access.userId },
              orderBy: [{ effectiveStartAt: "desc" }, { membershipGrantId: "asc" }],
              select: {
                effectiveEndAt: true,
                effectiveStartAt: true,
                membershipGrantId: true,
                monthsGranted: true,
                revocations: {
                  orderBy: [{ revokedAt: "asc" }, { membershipRevocationId: "asc" }],
                  select: { effectiveEndAfter: true },
                },
                source: true,
              },
            }),
            getDatabase().perk.findMany({
              orderBy: { perkId: "asc" },
              select: { description: true, name: true, perkId: true, status: true },
            }),
          ]);
          const membership = projectMembershipEntitlement(grants, new Date());
          return Response.json({
            active: membership.active,
            activePerks: activePerks(perks).map(({ description, name, perkId }) => ({ description, name, perkId })),
            effectiveEndAt: membership.effectiveEndAt?.toISOString() ?? null,
            grants: grants.map((grant) => ({
              effectiveEndAt: grant.revocations.reduce(
                (earliest, revocation) => earliest < revocation.effectiveEndAfter ? earliest : revocation.effectiveEndAfter,
                grant.effectiveEndAt,
              ).toISOString(),
              effectiveStartAt: grant.effectiveStartAt.toISOString(),
              membershipGrantId: grant.membershipGrantId,
              monthsGranted: grant.monthsGranted,
              source: grant.source,
            })),
            voiceWindowSeconds: voiceWindowSeconds(membership.active),
          });
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    },
  },
});
