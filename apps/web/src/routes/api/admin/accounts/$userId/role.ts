import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdminCapability } from "../../../../../server/access";
import { getDatabase } from "../../../../../server/database";

const roleSchema = z.object({ role: z.enum(["user", "member", "admin", "owner"]) });

export const Route = createFileRoute("/api/admin/accounts/$userId/role")({
  server: {
    handlers: {
      PATCH: async ({ params, request }) => {
        try {
          await requireAdminCapability(request, "changeAuthorizationRoles");
          const { role } = roleSchema.parse(await request.json());
          const account = await getDatabase().user.update({
            where: { id: params.userId },
            data: { role },
            select: { id: true, role: true },
          });
          return Response.json({ userId: account.id, role: account.role });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: "A valid authorization role is required." }, { status: 400 });
          return Response.json({ error: "Account role could not be changed." }, { status: 400 });
        }
      },
    },
  },
});
