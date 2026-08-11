import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticateExternalBulkApi, recordBulkOperation, type BulkApiAccess } from "../../../../../server/bulk-operations";
import { deleteEntityRecord, entityForAdminKey, getEntityRecord, updateEntityRecord } from "../../../../../server/entity-admin";
import { getDatabase } from "../../../../../server/database";

const bodySchema = z.object({ record: z.unknown() }).strict();

async function failed(access: BulkApiAccess, entityName: string, operation: "DELETE" | "QUERY" | "UPDATE", error: unknown): Promise<Response> {
  await recordBulkOperation({ detail: error instanceof Error ? error.message : "External operation failed.", entityName, externalBulkApiSessionId: access.externalBulkApiSessionId, operation, recordCount: 0, result: "FAILED" });
  return Response.json({ error: "External data operation failed validation or persistence." }, { status: 400 });
}

export const Route = createFileRoute("/api/external/data/$entityKey/$recordId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const access = await authenticateExternalBulkApi(request);
        try {
          const entity = entityForAdminKey(params.entityKey);
          const record = await getEntityRecord(getDatabase(), entity, params.recordId);
          await recordBulkOperation({ entityName: entity, externalBulkApiSessionId: access.externalBulkApiSessionId, operation: "QUERY", recordCount: record ? 1 : 0, result: "UNCHANGED" });
          return record ? Response.json({ record }) : Response.json({ error: "Record not found." }, { status: 404 });
        } catch (error) {
          return failed(access, params.entityKey, "QUERY", error);
        }
      },
      PATCH: async ({ params, request }) => {
        const access = await authenticateExternalBulkApi(request);
        try {
          const entity = entityForAdminKey(params.entityKey);
          const input = bodySchema.parse(await request.json());
          const record = await updateEntityRecord(getDatabase(), entity, params.recordId, input.record);
          await recordBulkOperation({ entityName: entity, externalBulkApiSessionId: access.externalBulkApiSessionId, operation: "UPDATE", recordCount: 1, result: "CHANGED" });
          return Response.json({ record });
        } catch (error) {
          return failed(access, params.entityKey, "UPDATE", error);
        }
      },
      DELETE: async ({ params, request }) => {
        const access = await authenticateExternalBulkApi(request);
        try {
          const entity = entityForAdminKey(params.entityKey);
          const record = await deleteEntityRecord(getDatabase(), entity, params.recordId);
          await recordBulkOperation({ entityName: entity, externalBulkApiSessionId: access.externalBulkApiSessionId, operation: "DELETE", recordCount: 1, result: "CHANGED" });
          return Response.json({ record });
        } catch (error) {
          return failed(access, params.entityKey, "DELETE", error);
        }
      },
    },
  },
});
