import { createFileRoute } from "@tanstack/react-router";

import { deliverAtlasTexture } from "../../../server/atlas-texture";

export const Route = createFileRoute("/api/atlas/texture")({
  server: { handlers: { GET: async ({ request }) => deliverAtlasTexture(new URL(request.url)) } },
});
