import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requirePlayerAccess } from "../../../../server/access";
import { getStoreCheckoutStatus } from "../../../../server/storefront";

const checkoutReferenceSchema = z.string().trim().min(1).max(500);

export const Route = createFileRoute("/api/store/checkout/status")({
  server: { handlers: { GET: async ({ request }) => {
    try {
      const access = await requirePlayerAccess(request);
      const checkoutReference = checkoutReferenceSchema.parse(new URL(request.url).searchParams.get("sessionId"));
      const order = await getStoreCheckoutStatus({ checkoutReference, userId: access.userId });
      return order ? Response.json({ order }) : Response.json({ error: "Checkout order was not found." }, { status: 404 });
    } catch (error) {
      if (error instanceof Response) return error;
      if (error instanceof z.ZodError) return Response.json({ error: "A checkout session reference is required." }, { status: 400 });
      return Response.json({ error: "Checkout status could not be loaded." }, { status: 500 });
    }
  } } },
});
