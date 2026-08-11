import { createFileRoute } from "@tanstack/react-router";

import { requirePlayerAccess } from "../../../server/access";
import { getPlayerCalendar } from "../../../server/player-calendar";

export const Route = createFileRoute("/api/player/calendar")({
  server: { handlers: { GET: async ({ request }) => {
    try { await requirePlayerAccess(request); return Response.json(await getPlayerCalendar()); }
    catch (error) { if (error instanceof Response) return error; throw error; }
  } } },
});
