import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireServerSession } from "../../../server/access";
import { betaInviteRequestInputSchema, submitBetaInviteRequest } from "../../../server/beta-invitations";

export const Route = createFileRoute("/api/beta-invitations/request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const access = await requireServerSession(request);
          const input = betaInviteRequestInputSchema.parse(await request.json());
          await submitBetaInviteRequest({ ...input, requesterId: access.userId });
          return Response.json({ received: true });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: "A valid friend name, email, and reason are required." }, { status: 400 });
          throw error;
        }
      },
    },
  },
});
