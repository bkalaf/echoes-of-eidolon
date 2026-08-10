import { createFileRoute } from "@tanstack/react-router";

import { getAtlasCatalog } from "../../../server/atlas";
import { requireAtlasAccess } from "../../../server/access";

export const Route = createFileRoute("/api/atlas/catalog")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAtlasAccess(request);
          return Response.json(await getAtlasCatalog());
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    },
  },
});
