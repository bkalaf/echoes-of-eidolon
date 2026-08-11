import { createFileRoute } from "@tanstack/react-router";

import { requireServerSession } from "../../../../server/access";
import { cancelSubscriptionRenewal } from "../../../../server/subscriptions";

export const Route = createFileRoute("/api/account/subscription/cancel")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const access = await requireServerSession(request);
      return Response.json({ subscription: await cancelSubscriptionRenewal(access.userId) });
    } catch (error) {
      if (error instanceof Response) return error;
      return Response.json({ error: error instanceof Error ? error.message : "Subscription renewal could not be canceled." }, { status: 409 });
    }
  } } },
});
