import { createFileRoute } from "@tanstack/react-router";

import { getPublicReleaseIndex, listPublicReleases } from "../../server/releases";

export const Route = createFileRoute("/api/releases")({
  server: { handlers: { GET: async () => Response.json({ currentVersion: getPublicReleaseIndex().currentVersion, releases: await listPublicReleases() }) } },
});
