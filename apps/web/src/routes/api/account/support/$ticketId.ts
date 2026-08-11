import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireServerSession } from "../../../../server/access";
import { getHelpTicket, helpTicketReplySchema, replyToHelpTicket } from "../../../../server/help-tickets";

export const Route = createFileRoute("/api/account/support/$ticketId")({ server: { handlers: {
  GET: async ({ params, request }) => { try { const access = await requireServerSession(request); const ticket = await getHelpTicket(params.ticketId, access.userId); return ticket ? Response.json({ ticket }) : Response.json({ error: "Help Ticket not found." }, { status: 404 }); } catch (error) { if (error instanceof Response) return error; throw error; } },
  POST: async ({ params, request }) => { try { const access = await requireServerSession(request); const input = helpTicketReplySchema.parse(await request.json()); return Response.json({ ticket: await replyToHelpTicket({ helpTicketId: params.ticketId, request: input, userId: access.userId }) }); } catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Reply input is invalid." }, { status: 400 }); return Response.json({ error: error instanceof Error ? error.message : "Reply could not be submitted." }, { status: 409 }); } },
} } });
