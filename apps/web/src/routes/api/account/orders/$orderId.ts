import { createFileRoute } from "@tanstack/react-router";

import { requireServerSession } from "../../../../server/access";
import { getAccountOrder } from "../../../../server/account-orders";

export const Route = createFileRoute("/api/account/orders/$orderId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const access = await requireServerSession(request);
          const order = await getAccountOrder(params.orderId, access.userId);
          return order
            ? Response.json({ order })
            : Response.json({ error: "Order not found." }, { status: 404 });
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    },
  },
});
