import { createFileRoute } from "@tanstack/react-router";

import { requireServerSession } from "../../../../server/access";
import { createSubscriptionCheckout } from "../../../../server/subscriptions";

export const Route = createFileRoute("/api/account/subscription/checkout")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const access = await requireServerSession(request);
      return Response.json(await createSubscriptionCheckout({ email: access.email, userId: access.userId }), { status: 201 });
    } catch (error) {
      if (error instanceof Response) return error;
      return Response.json({ error: "Subscription checkout could not be started." }, { status: 503 });
    }
  } } },
});
