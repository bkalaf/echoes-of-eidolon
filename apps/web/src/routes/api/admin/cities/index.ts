import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../server/access";
import { CityBuilderConflictError, createCityProject, createCityProjectSchema, listCityProjects } from "../../../../server/city-builder";

function cityError(error: unknown): Response {
  if (error instanceof Response) return error;
  if (error instanceof z.ZodError) return Response.json({ error: "A valid SettlementWorld is required." }, { status: 400 });
  if (error instanceof CityBuilderConflictError) return Response.json({ error: error.message }, { status: 409 });
  return Response.json({ error: "The City Builder operation failed." }, { status: 500 });
}

export const Route = createFileRoute("/api/admin/cities/")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        await requireAdministration(request);
        return Response.json(await listCityProjects());
      } catch (error) {
        return cityError(error);
      }
    },
    POST: async ({ request }) => {
      try {
        await requireAdministration(request);
        const city = await createCityProject(createCityProjectSchema.parse(await request.json()));
        return Response.json({ city }, { status: 201 });
      } catch (error) {
        return cityError(error);
      }
    },
  } },
});
