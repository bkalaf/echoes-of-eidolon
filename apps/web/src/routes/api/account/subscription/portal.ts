import { createFileRoute } from "@tanstack/react-router";

import { requireServerSession } from "../../../../server/access";
import { createSubscriptionPortal } from "../../../../server/subscriptions";

export const Route = createFileRoute("/api/account/subscription/portal")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const access = await requireServerSession(request);
      return Response.json(await createSubscriptionPortal(access.userId));
    } catch (error) {
      if (error instanceof Response) return error;
      return Response.json({ error: error instanceof Error ? error.message : "Stripe Customer Portal is unavailable." }, { status: 409 });
    }
  } } },
});
