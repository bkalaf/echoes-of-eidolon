import { createFileRoute } from "@tanstack/react-router";

import { findPublicRelease } from "../../../server/releases";

export const Route = createFileRoute("/api/releases/$version")({
  server: { handlers: { GET: async ({ params }) => {
    const release = await findPublicRelease(params.version);
    return release ? Response.json({ release }) : Response.json({ error: "Published release not found." }, { status: 404 });
  } } },
});
