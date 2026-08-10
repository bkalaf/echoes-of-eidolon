import { createFileRoute } from "@tanstack/react-router";

import { requireServerSession } from "../../../../server/access";
import { listAccountOrders } from "../../../../server/account-orders";

export const Route = createFileRoute("/api/account/orders/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const access = await requireServerSession(request);
          return Response.json({ orders: await listAccountOrders(access.userId) });
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    },
  },
});

