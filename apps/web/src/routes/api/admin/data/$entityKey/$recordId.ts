import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../../server/access";
import { deleteEntityRecord, EntityAdminValidationError, entityAdminContract, entityForAdminKey, getEntityRecord, updateEntityRecord } from "../../../../../server/entity-admin";
import { getDatabase } from "../../../../../server/database";
import { UnsupportedImportEntityError } from "../../../../../server/import-errors";

const bodySchema = z.object({ record: z.unknown() }).strict();

function errorResponse(error: unknown): Response {
  if (error instanceof Response) return error;
  if (error instanceof EntityAdminValidationError || error instanceof UnsupportedImportEntityError || error instanceof z.ZodError || error instanceof SyntaxError) {
    return Response.json({ error: error instanceof Error ? error.message : "Entity input is invalid." }, { status: 400 });
  }
  return Response.json({ error: "Entity operation failed." }, { status: 409 });
}

export const Route = createFileRoute("/api/admin/data/$entityKey/$recordId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          await requireAdministration(request);
          const entity = entityForAdminKey(params.entityKey);
          const record = await getEntityRecord(getDatabase(), entity, params.recordId);
          return record
            ? Response.json({ contract: entityAdminContract(entity), entity, record })
            : Response.json({ error: `${entity} record not found.` }, { status: 404 });
        } catch (error) {
          return errorResponse(error);
        }
      },
      PATCH: async ({ params, request }) => {
        try {
          await requireAdministration(request);
          const entity = entityForAdminKey(params.entityKey);
          const body = bodySchema.parse(await request.json());
          const record = await updateEntityRecord(getDatabase(), entity, params.recordId, body.record);
          return Response.json({ record });
        } catch (error) {
          return errorResponse(error);
        }
      },
      DELETE: async ({ params, request }) => {
        try {
          await requireAdministration(request);
          const entity = entityForAdminKey(params.entityKey);
          const record = await deleteEntityRecord(getDatabase(), entity, params.recordId);
          return Response.json({ record });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
