import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireServerSession } from "../../../../server/access";
import { AccountSessionRequestError, revokeOneOtherSession } from "../../../../server/account-sessions";

const inputSchema = z.object({ sessionId: z.string().min(1) }).strict();

export const Route = createFileRoute("/api/account/sessions/revoke-other")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const access = await requireServerSession(request);
          const input = inputSchema.parse(await request.json());
          await revokeOneOtherSession({
            currentSessionToken: access.sessionToken,
            sessionId: input.sessionId,
            userId: access.userId,
          });
          return Response.json({ revoked: true });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) {
            return Response.json({ error: "A session identifier is required." }, { status: 400 });
          }
          if (error instanceof AccountSessionRequestError) {
            return Response.json({ error: error.message }, { status: error.status });
          }
          throw error;
        }
      },
    },
  },
});
