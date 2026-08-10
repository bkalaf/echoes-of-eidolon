import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdminCapability } from "../../../../server/access";
import { getDatabase } from "../../../../server/database";

const perkUpdateSchema = z.object({
  description: z.string(),
  name: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
}).strict();

export const Route = createFileRoute("/api/admin/perks/$perkId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          await requireAdminCapability(request, "configurePerks");
          const perk = await getDatabase().perk.findUnique({
            where: { perkId: params.perkId },
            select: { description: true, name: true, perkId: true, status: true },
          });
          return perk ? Response.json({ perk }) : Response.json({ error: "Perk not found." }, { status: 404 });
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
      PATCH: async ({ params, request }) => {
        try {
          await requireAdminCapability(request, "configurePerks");
          const data = perkUpdateSchema.parse(await request.json());
          const perk = await getDatabase().perk.update({
            where: { perkId: params.perkId },
            data,
            select: { description: true, name: true, perkId: true, status: true },
          });
          return Response.json({ perk });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: "Perk fields or status are invalid." }, { status: 400 });
          return Response.json({ error: "Perk could not be updated." }, { status: 400 });
        }
      },
    },
  },
});
