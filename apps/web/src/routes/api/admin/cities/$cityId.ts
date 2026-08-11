import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../server/access";
import { CityBuilderConflictError, cityGeometryMutationSchema, getCityProject, saveCityGeometry } from "../../../../server/city-builder";

function cityError(error: unknown): Response {
  if (error instanceof Response) return error;
  if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "City geometry input is invalid." }, { status: 400 });
  if (error instanceof CityBuilderConflictError) return Response.json({ error: error.message }, { status: 409 });
  return Response.json({ error: "The City Builder operation failed." }, { status: 500 });
}

export const Route = createFileRoute("/api/admin/cities/$cityId")({
  server: { handlers: {
    GET: async ({ params, request }) => {
      try {
        await requireAdministration(request);
        return Response.json({ city: await getCityProject(params.cityId) });
      } catch (error) {
        return cityError(error);
      }
    },
    PUT: async ({ params, request }) => {
      try {
        await requireAdministration(request);
        const city = await saveCityGeometry(params.cityId, cityGeometryMutationSchema.parse(await request.json()));
        return Response.json({ city });
      } catch (error) {
        return cityError(error);
      }
    },
  } },
});
