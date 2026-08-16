import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdminCapability } from "../../../server/access";
import { enableKeylessExternalBulkApi, externalBulkApiOverview, generateExternalBulkApiKey, revokeExternalBulkApiKey } from "../../../server/bulk-operations";
import { decideBulkEnvelope, rerunBulkEnvelopeDryRun } from "../../../server/bulk-gateway";
import { getDatabase } from "../../../server/database";
import type { PrismaClient } from "../../../generated/prisma/client";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate") }).strict(),
  z.object({ action: z.literal("enable-keyless") }).strict(),
  z.object({ action: z.literal("revoke"), sessionId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("apply"), envelopeId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("delete"), envelopeId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("rerun"), envelopeId: z.string().uuid() }).strict(),
]);

type BulkAdminAuthorizer = (request: Request, capability: "operateBulkApi") => Promise<{ userId: string }>;

export async function handleBulkOperationsAdminRequest(
  method: "GET" | "POST",
  request: Request,
  database: PrismaClient = getDatabase(),
  authorize: BulkAdminAuthorizer = requireAdminCapability,
): Promise<Response> {
  try {
    const access = await authorize(request, "operateBulkApi");
    if (method === "GET") return Response.json(await externalBulkApiOverview(database));
    const input = actionSchema.parse(await request.json());
    if (input.action === "generate") return Response.json(await generateExternalBulkApiKey(access.userId, database), { status: 201 });
    if (input.action === "enable-keyless") return Response.json(await enableKeylessExternalBulkApi(access.userId, database), { status: 201 });
    if (input.action === "apply") return Response.json(await decideBulkEnvelope(input.envelopeId, access.userId, "APPLY", database));
    if (input.action === "delete") return Response.json(await decideBulkEnvelope(input.envelopeId, access.userId, "DELETE", database));
    if (input.action === "rerun") return Response.json(await rerunBulkEnvelopeDryRun(input.envelopeId, database));
    await revokeExternalBulkApiKey(input.sessionId, database);
    return Response.json({ revoked: true });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Bulk API action is invalid." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Bulk API action failed." }, { status: 409 });
  }
}

export const Route = createFileRoute("/api/admin/bulk-operations")({
  server: {
    handlers: {
      GET: ({ request }) => handleBulkOperationsAdminRequest("GET", request),
      POST: ({ request }) => handleBulkOperationsAdminRequest("POST", request),
    },
  },
});
