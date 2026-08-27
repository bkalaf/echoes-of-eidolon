import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { canAccessPuzzles } from "./domain/authorization";
import { getServerAccessContext } from "./server/access";

export default createServerEntry({
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    const isPuzzlePage = request.method === "GET" && (pathname === "/puzzles" || pathname.startsWith("/puzzles/"));
    const access = isPuzzlePage ? await getServerAccessContext(request) : null;
    const puzzleAccessForbidden = access !== null && !canAccessPuzzles(access.role, access.membershipEntitled);
    const response = await handler.fetch(request);
    if (!puzzleAccessForbidden) return response;

    return new Response(response.body, { headers: response.headers, status: 403, statusText: "Forbidden" });
  },
});
