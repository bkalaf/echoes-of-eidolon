import { createFileRoute } from "@tanstack/react-router";

import { projectPublicAtlas } from "../../../domain/public-atlas";
import { getAtlasReleaseBundle, getAtlasTopology } from "../../../server/atlas";

export const Route = createFileRoute("/api/atlas/public")({
  server: { handlers: { GET: async () => {
    const [release, topology] = await Promise.all([getAtlasReleaseBundle(), getAtlasTopology()]);
    return Response.json(projectPublicAtlas(release, topology));
  } } },
});
