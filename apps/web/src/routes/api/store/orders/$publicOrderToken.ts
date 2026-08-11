import { createFileRoute } from "@tanstack/react-router";

import { getPublicOrder } from "../../../../server/guest-orders";

export const Route = createFileRoute("/api/store/orders/$publicOrderToken")({
  server: { handlers: { GET: async ({ params }) => {
    const order = await getPublicOrder(params.publicOrderToken);
    return order ? Response.json({ order }) : Response.json({ error: "Order status link is invalid or expired." }, { status: 404 });
  } } },
});
