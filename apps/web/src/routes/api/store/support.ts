import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getServerAccessContext } from "../../../server/access";
import { authorizePublicOrderToken } from "../../../server/guest-orders";
import { createHelpTicket, helpTicketCreateSchema } from "../../../server/help-tickets";

const storeSupportSchema = helpTicketCreateSchema.extend({ publicOrderToken: z.string().min(1).optional() });

export const Route = createFileRoute("/api/store/support")({ server: { handlers: { POST: async ({ request }) => {
  try {
    const access = await getServerAccessContext(request);
    const input = storeSupportSchema.parse(await request.json());
    const guestOrder = access || !input.publicOrderToken ? null : await authorizePublicOrderToken(input.publicOrderToken);
    if (!access && !guestOrder) return Response.json({ error: "Sign in or provide a valid private order token." }, { status: 401 });
    const ticket = await createHelpTicket({
      channel: "STORE",
      contactEmail: access?.email ?? guestOrder!.contactEmail,
      request: {
        attachments: input.attachments,
        categoryKey: input.categoryKey,
        message: input.message,
        orderId: access ? input.orderId : guestOrder!.orderId,
        subject: input.subject,
      },
      userId: access?.userId ?? null,
    });
    return Response.json({ ticket }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Store support input is invalid." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Store support request could not be submitted." }, { status: 409 });
  }
} } } });
