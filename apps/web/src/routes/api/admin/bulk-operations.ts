import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdminCapability } from "../../../server/access";
import { externalBulkApiOverview, generateExternalBulkApiKey, revokeExternalBulkApiKey } from "../../../server/bulk-operations";
import { getDatabase } from "../../../server/database";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate") }).strict(),
  z.object({ action: z.literal("revoke"), sessionId: z.string().uuid() }).strict(),
]);

export const Route = createFileRoute("/api/admin/bulk-operations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdminCapability(request, "operateBulkApi");
          return Response.json(await externalBulkApiOverview(getDatabase()));
        } catch (error) {
          if (error instanceof Response) return error;
          return Response.json({ error: "Bulk operation state could not be loaded." }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const access = await requireAdminCapability(request, "operateBulkApi");
          const input = actionSchema.parse(await request.json());
          if (input.action === "generate") return Response.json(await generateExternalBulkApiKey(access.userId, getDatabase()), { status: 201 });
          await revokeExternalBulkApiKey(input.sessionId, getDatabase());
          return Response.json({ revoked: true });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Bulk API action is invalid." }, { status: 400 });
          return Response.json({ error: error instanceof Error ? error.message : "Bulk API action failed." }, { status: 409 });
        }
      },
    },
  },
});
