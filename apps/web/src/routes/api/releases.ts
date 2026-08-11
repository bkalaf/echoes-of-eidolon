import { createFileRoute } from "@tanstack/react-router";

import { listPublicReleases } from "../../server/releases";

export const Route = createFileRoute("/api/releases")({
  server: { handlers: { GET: async () => Response.json({ releases: await listPublicReleases() }) } },
});
