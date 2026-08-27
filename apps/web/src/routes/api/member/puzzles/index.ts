import { createFileRoute } from "@tanstack/react-router";

import { requirePuzzleAccess } from "../../../../server/access";
import { getMemberPuzzleCatalog } from "../../../../server/member-puzzles";

export const Route = createFileRoute("/api/member/puzzles/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requirePuzzleAccess(request);
          return Response.json(getMemberPuzzleCatalog(), { headers: { "cache-control": "no-store, private" } });
        } catch (error) {
          if (error instanceof Response) return error;
          return Response.json({ error: "Member puzzles could not be loaded." }, { status: 500 });
        }
      },
    },
  },
});
