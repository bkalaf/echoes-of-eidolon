import { createFileRoute } from "@tanstack/react-router";

function retired() {
  return Response.json({ error: "This legacy external data route no longer mutates or projects records. Use the typed /api/external/bulk contract." }, {
    headers: { link: "</api/external/bulk>; rel=successor-version" },
    status: 410,
  });
}

export const Route = createFileRoute("/api/external/data/$entityKey")({
  server: { handlers: { GET: retired, POST: retired } },
});
