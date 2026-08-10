import { createFileRoute } from "@tanstack/react-router";

import { getPublicHealthReport } from "../../server/health";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => Response.json(await getPublicHealthReport()),
    },
  },
});
