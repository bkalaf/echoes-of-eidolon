import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdminCapability } from "../../../../../server/access";
import { approveBetaInviteRequest } from "../../../../../server/beta-invitations";

export const betaInvitationApprovalSchema = z.object({ expiresAt: z.iso.datetime() }).strict();

export const Route = createFileRoute("/api/admin/beta-invitations/$id/approve")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        try {
          await requireAdminCapability(request, "reviewInvitations");
          const { expiresAt } = betaInvitationApprovalSchema.parse(await request.json());
          await approveBetaInviteRequest({ expiresAt: new Date(expiresAt), requestId: params.id });
          return Response.json({ approved: true });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: "An explicit invitation expiry is required." }, { status: 400 });
          return Response.json({ error: error instanceof Error ? error.message : "Invitation request could not be approved." }, { status: 400 });
        }
      },
    },
  },
});
