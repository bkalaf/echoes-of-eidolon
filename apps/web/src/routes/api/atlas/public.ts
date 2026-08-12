import { createFileRoute } from "@tanstack/react-router";

import { projectPublicAtlas } from "../../../domain/public-atlas";
import { getAtlasCatalogProjection } from "../../../server/atlas";
import { getDatabase } from "../../../server/database";

export const Route = createFileRoute("/api/atlas/public")({
  server: { handlers: { GET: async () => {
    const [atlas, settlements] = await Promise.all([
      getAtlasCatalogProjection(),
      getDatabase().settlementWorld.findMany({ where: { worldKey: "RUIN" }, select: { settlement: { select: { classification: true, name: true, settlementId: true, site: { select: { latitude: true, longitude: true, regionId: true, siteId: true } } } } } }),
    ]);
    return Response.json(projectPublicAtlas(atlas, settlements));
  } } },
});
