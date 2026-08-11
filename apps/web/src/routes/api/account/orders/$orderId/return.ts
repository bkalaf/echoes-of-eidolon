import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireServerSession } from "../../../../../server/access";
import { createHelpTicket, helpTicketCreateSchema } from "../../../../../server/help-tickets";

const returnSchema = helpTicketCreateSchema.omit({ categoryKey: true, orderId: true });

export const Route = createFileRoute("/api/account/orders/$orderId/return")({ server: { handlers: { POST: async ({ params, request }) => {
  try {
    const access = await requireServerSession(request);
    const input = returnSchema.parse(await request.json());
    const ticket = await createHelpTicket({ channel: "RETURN", contactEmail: access.email, request: { ...input, categoryKey: "RETURN_REQUEST", orderId: params.orderId }, userId: access.userId });
    return Response.json({ ticket }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Return request is invalid." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Return request could not be submitted." }, { status: 409 });
  }
} } } });
