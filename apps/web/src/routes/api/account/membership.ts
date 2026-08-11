import { createFileRoute } from "@tanstack/react-router";

import { activePerks, projectMembershipEntitlement, voiceWindowSeconds } from "../../../domain/membership";
import { requireServerSession } from "../../../server/access";
import { getDatabase } from "../../../server/database";
import { getSubscriptionState } from "../../../server/subscriptions";

export const Route = createFileRoute("/api/account/membership")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const access = await requireServerSession(request);
          const [grants, perks, subscription] = await Promise.all([
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
            getSubscriptionState(access.userId),
          ]);
          const membership = projectMembershipEntitlement(grants, new Date());
          return Response.json({
            active: membership.active,
            activePerks: activePerks(perks, membership.active).map(({ description, name, perkId }) => ({ description, name, perkId })),
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
            subscription: subscription ? {
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              canceledAt: subscription.canceledAt?.toISOString() ?? null,
              currentPeriodEndAt: subscription.currentPeriodEndAt?.toISOString() ?? null,
              currentPeriodStartAt: subscription.currentPeriodStartAt?.toISOString() ?? null,
              events: subscription.events.map((event) => ({
                eventType: event.eventType,
                occurredAt: event.occurredAt.toISOString(),
                providerStatus: event.providerStatus,
              })),
              providerStatus: subscription.providerStatus,
              stripeCustomerReference: subscription.stripeCustomerReference,
            } : null,
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
