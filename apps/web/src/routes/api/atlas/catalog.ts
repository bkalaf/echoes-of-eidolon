import { createFileRoute } from "@tanstack/react-router";

import { getAtlasCatalog } from "../../../server/atlas";

export const Route = createFileRoute("/api/atlas/catalog")({
  server: {
    handlers: {
      GET: async () => Response.json(await getAtlasCatalog()),
    },
  },
});
