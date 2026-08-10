import { createFileRoute } from "@tanstack/react-router";

import { sitemapDocument } from "../lib/crawlability";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: ({ request }) => new Response(sitemapDocument(new URL(request.url).origin), {
        headers: { "content-type": "application/xml; charset=utf-8" },
      }),
    },
  },
});
