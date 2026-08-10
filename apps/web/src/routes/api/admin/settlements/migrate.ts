import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../server/access";
import { migratePopulation } from "../../../../server/settlements";

export const migrationInputSchema = z.object({
  destinationSettlementId: z.string().min(1),
  originSettlementId: z.string().min(1),
  rows: z.array(z.object({
    amount: z.number().int().positive(),
    breedId: z.string().min(1),
  }).strict()).min(1),
  worldKey: z.enum(["CONCORD", "RUIN", "SCHISM"]),
  year: z.number().int().min(0).max(4040),
}).strict();

export const Route = createFileRoute("/api/admin/settlements/migrate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAdministration(request);
          await migratePopulation(migrationInputSchema.parse(await request.json()));
          return Response.json({ migrated: true });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: "Migration input is invalid." }, { status: 400 });
          return Response.json({ error: error instanceof Error ? error.message : "Migration failed." }, { status: 400 });
        }
      },
    },
  },
});
