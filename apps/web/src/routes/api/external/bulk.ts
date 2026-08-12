import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { handleExternalBulkRequest } from "../../../server/bulk-gateway";

async function respond(request: Request, method: "DELETE" | "GET" | "POST" | "PUT") {
  try {
    const result = await handleExternalBulkRequest(request, method);
    return Response.json(result, { status: method === "GET" || (method === "POST" && "records" in result) ? 200 : 202 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "The typed bulk request is invalid." }, { status: 400 });
    return Response.json({ error: "The bulk request could not be processed." }, { status: 409 });
  }
}

export const Route = createFileRoute("/api/external/bulk")({
  server: { handlers: {
    GET: ({ request }) => respond(request, "GET"),
    POST: ({ request }) => respond(request, "POST"),
    PUT: ({ request }) => respond(request, "PUT"),
    DELETE: ({ request }) => respond(request, "DELETE"),
  } },
});
