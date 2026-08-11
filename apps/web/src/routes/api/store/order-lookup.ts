import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requestOrderStatusLink } from "../../../server/guest-orders";

const inputSchema = z.object({ email: z.email(), orderId: z.string().trim().min(1).max(200) }).strict();

export const Route = createFileRoute("/api/store/order-lookup")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const input = inputSchema.parse(await request.json());
      const rateLimitKey = `${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}:${input.email.toLowerCase()}`;
      await requestOrderStatusLink({ ...input, rateLimitKey });
      return Response.json({ message: "If the order details match, a private status link has been sent." }, { status: 202 });
    } catch (error) {
      if (error instanceof Response) return error.status === 429 ? Response.json({ error: "Too many attempts. Try again later." }, { status: 429 }) : error;
      if (error instanceof z.ZodError) return Response.json({ error: "Order number and a valid email are required." }, { status: 400 });
      return Response.json({ error: "Order lookup is temporarily unavailable." }, { status: 503 });
    }
  } } },
});
