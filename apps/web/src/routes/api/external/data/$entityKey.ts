import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticateExternalBulkApi, recordBulkOperation, type BulkApiAccess } from "../../../../server/bulk-operations";
import { createEntityRecord, entityForAdminKey, listEntityRecords } from "../../../../server/entity-admin";
import { getDatabase } from "../../../../server/database";

const bodySchema = z.object({ record: z.unknown() }).strict();

async function failed(access: BulkApiAccess, entityName: string, operation: "CREATE" | "QUERY", error: unknown): Promise<Response> {
  await recordBulkOperation({ detail: error instanceof Error ? error.message : "External operation failed.", entityName, externalBulkApiSessionId: access.externalBulkApiSessionId, operation, recordCount: 0, result: "FAILED" });
  return Response.json({ error: "External data operation failed validation or persistence." }, { status: 400 });
}

export const Route = createFileRoute("/api/external/data/$entityKey")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const access = await authenticateExternalBulkApi(request);
        try {
          const entity = entityForAdminKey(params.entityKey);
          const records = await listEntityRecords(getDatabase(), entity);
          await recordBulkOperation({ entityName: entity, externalBulkApiSessionId: access.externalBulkApiSessionId, operation: "QUERY", recordCount: records.length, result: "UNCHANGED" });
          return Response.json({ entity, records });
        } catch (error) {
          return failed(access, params.entityKey, "QUERY", error);
        }
      },
      POST: async ({ params, request }) => {
        const access = await authenticateExternalBulkApi(request);
        try {
          const entity = entityForAdminKey(params.entityKey);
          const input = bodySchema.parse(await request.json());
          const record = await createEntityRecord(getDatabase(), entity, input.record);
          await recordBulkOperation({ entityName: entity, externalBulkApiSessionId: access.externalBulkApiSessionId, operation: "CREATE", recordCount: 1, result: "CHANGED" });
          return Response.json({ record }, { status: 201 });
        } catch (error) {
          return failed(access, params.entityKey, "CREATE", error);
        }
      },
    },
  },
});
