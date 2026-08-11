import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { companyContactInputSchema, submitCompanyContact } from "../../server/contact";

export const Route = createFileRoute("/api/contact")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      return Response.json(await submitCompanyContact(companyContactInputSchema.parse(await request.json())), { status: 202 });
    } catch (error) {
      if (error instanceof z.ZodError) return Response.json({ error: "A valid topic, reply email, and message are required." }, { status: 400 });
      throw error;
    }
  } } },
});
