import { createFileRoute } from "@tanstack/react-router";

import { getAuth } from "../../../server/auth";

async function handleAuthRequest({ request }: { request: Request }): Promise<Response> {
  return getAuth().handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handleAuthRequest,
      POST: handleAuthRequest,
    },
  },
});
