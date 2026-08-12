import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/external/data/$entityKey/import")({
  server: { handlers: { POST: () => Response.json({ error: "Legacy external imports are retired. Submit a typed mutation envelope to /api/external/bulk." }, {
    headers: { link: "</api/external/bulk>; rel=successor-version" },
    status: 410,
  }) } },
});
