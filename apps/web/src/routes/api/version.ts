import { createFileRoute } from "@tanstack/react-router";

import { getBuildIdentity } from "../../server/releases";

export const Route = createFileRoute("/api/version")({
  server: { handlers: { GET: async () => Response.json(getBuildIdentity()) } },
});
