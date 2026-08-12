import { createFileRoute } from "@tanstack/react-router";

import { requirePlayerAccess } from "../../../server/access";
import { getPlayerGameplayProjection } from "../../../server/player-gameplay";

export const Route = createFileRoute("/api/player/gameplay")({ server: { handlers: { GET: async ({ request }) => {
  try {
    const access = await requirePlayerAccess(request);
    return Response.json(await getPlayerGameplayProjection(access.userId, access.role));
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "Player gameplay state could not be loaded." }, { status: 500 });
  }
} } } });
