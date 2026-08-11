import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../server/access";
import { createEntityRecord, EntityAdminValidationError, entityAdminContract, entityForAdminKey, listEntityRecords } from "../../../../server/entity-admin";
import { getDatabase } from "../../../../server/database";
import { UnsupportedImportEntityError } from "../../../../server/import-errors";

const bodySchema = z.object({ record: z.unknown() }).strict();

function errorResponse(error: unknown): Response {
  if (error instanceof Response) return error;
  if (error instanceof EntityAdminValidationError || error instanceof UnsupportedImportEntityError || error instanceof z.ZodError || error instanceof SyntaxError) {
    return Response.json({ error: error instanceof Error ? error.message : "Entity input is invalid." }, { status: 400 });
  }
  return Response.json({ error: "Entity operation failed." }, { status: 409 });
}

export const Route = createFileRoute("/api/admin/data/$entityKey")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          await requireAdministration(request);
          const entity = entityForAdminKey(params.entityKey);
          const records = await listEntityRecords(getDatabase(), entity);
          return Response.json({ contract: entityAdminContract(entity), entity, records });
        } catch (error) {
          return errorResponse(error);
        }
      },
      POST: async ({ params, request }) => {
        try {
          await requireAdministration(request);
          const entity = entityForAdminKey(params.entityKey);
          const body = bodySchema.parse(await request.json());
          const record = await createEntityRecord(getDatabase(), entity, body.record);
          return Response.json({ record }, { status: 201 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
