import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireServerSession } from "../../../../server/access";
import { createHelpTicket, helpTicketCreateSchema, listHelpTickets } from "../../../../server/help-tickets";

export const Route = createFileRoute("/api/account/support/")({ server: { handlers: {
  GET: async ({ request }) => { try { const access = await requireServerSession(request); return Response.json({ tickets: await listHelpTickets(access.userId) }); } catch (error) { if (error instanceof Response) return error; throw error; } },
  POST: async ({ request }) => { try { const access = await requireServerSession(request); const input = helpTicketCreateSchema.parse(await request.json()); return Response.json({ ticket: await createHelpTicket({ channel: "PLAYER", contactEmail: access.email, request: input, userId: access.userId }) }, { status: 201 }); } catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Help Ticket input is invalid." }, { status: 400 }); return Response.json({ error: error instanceof Error ? error.message : "Help Ticket could not be created." }, { status: 409 }); } },
} } });
