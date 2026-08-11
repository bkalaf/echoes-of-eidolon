import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { WorldKey } from "../../../../generated/prisma/enums";
import { requireAdministration } from "../../../../server/access";
import { foundCity } from "../../../../server/settlements";

export const foundCityInputSchema = z.object({
  departures: z.array(z.object({
    amount: z.number().int().positive(),
    breedId: z.string().min(1),
    originSettlementWorldId: z.string().min(1),
  }).strict()).min(1),
  siteId: z.string().min(1),
  worldKey: z.enum(WorldKey),
  year: z.number().int().min(0).max(4040),
}).strict();

export const Route = createFileRoute("/api/admin/settlements/found-city")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAdministration(request);
          const input = foundCityInputSchema.parse(await request.json());
          return Response.json(await foundCity(input), { status: 201 });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: "Found City input is invalid." }, { status: 400 });
          return Response.json({ error: error instanceof Error ? error.message : "Found City failed." }, { status: 400 });
        }
      },
    },
  },
});
