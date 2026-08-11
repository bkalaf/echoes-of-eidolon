import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requirePlayerAccess } from "../../../server/access";
import { createDonationCheckout, donationCheckoutInputSchema } from "../../../server/donations";

export const Route = createFileRoute("/api/donations/checkout")({
  server: { handlers: { POST: async ({ request }) => { try { const access = await requirePlayerAccess(request); const input = donationCheckoutInputSchema.parse(await request.json()); return Response.json(await createDonationCheckout({ ...input, email: access.email, userId: access.userId }), { status: 201 }); } catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError) return Response.json({ error: "Donation amount must be between $10 and $100." }, { status: 400 }); throw error; } } } },
});
