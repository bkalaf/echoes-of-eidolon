import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireServerSession } from "../../../server/access";
import { betaInvitationRedemptionInputSchema, redeemBetaInvitation } from "../../../server/beta-invitations";

export const Route = createFileRoute("/api/beta-invitations/redeem")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const access = await requireServerSession(request);
          const { code } = betaInvitationRedemptionInputSchema.parse(await request.json());
          await redeemBetaInvitation({ code, email: access.email, userId: access.userId });
          return Response.json({ redeemed: true });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: "Invitation code is required." }, { status: 400 });
          return Response.json({ error: error instanceof Error ? error.message : "Invitation could not be redeemed." }, { status: 400 });
        }
      },
    },
  },
});
