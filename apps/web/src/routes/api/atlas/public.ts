import { createFileRoute } from "@tanstack/react-router";

import { projectPublicAtlas } from "../../../domain/public-atlas";
import { atlasGeographicPoints } from "../../../data/atlas-geographic-points";
import { getAtlasReleaseBundle, getAtlasTopology } from "../../../server/atlas";

export const Route = createFileRoute("/api/atlas/public")({
  server: { handlers: { GET: async () => {
    const [release, topology] = await Promise.all([getAtlasReleaseBundle(), getAtlasTopology()]);
    return Response.json(projectPublicAtlas({ ...release, geographicPoints: atlasGeographicPoints }, topology));
  } } },
});
