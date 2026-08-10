import { createFileRoute } from "@tanstack/react-router";

import { robotsDocument } from "../lib/crawlability";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) => new Response(robotsDocument(new URL(request.url).origin), {
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    },
  },
});
