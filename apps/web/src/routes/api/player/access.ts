import { createFileRoute } from "@tanstack/react-router";

import { playerAccessResponse, requireServerSession } from "../../../server/access";

export const Route = createFileRoute("/api/player/access")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return Response.json(playerAccessResponse(await requireServerSession(request)));
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    },
  },
});
