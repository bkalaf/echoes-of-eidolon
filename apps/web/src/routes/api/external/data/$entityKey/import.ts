import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticateExternalBulkApi, recordBulkOperation } from "../../../../../server/bulk-operations";
import { applyGenericEntityImport, entityForAdminKey } from "../../../../../server/entity-admin";
import { getDatabase } from "../../../../../server/database";

const bodySchema = z.object({ rows: z.array(z.unknown()).min(1) }).strict();

export const Route = createFileRoute("/api/external/data/$entityKey/import")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const access = await authenticateExternalBulkApi(request);
        try {
          const entity = entityForAdminKey(params.entityKey);
          const input = bodySchema.parse(await request.json());
          const result = await applyGenericEntityImport(input.rows, entity, getDatabase());
          await recordBulkOperation({ entityName: entity, externalBulkApiSessionId: access.externalBulkApiSessionId, operation: "IMPORT", recordCount: result.changed + result.unchanged, result: result.changed ? "CHANGED" : "UNCHANGED" });
          return Response.json(result);
        } catch (error) {
          await recordBulkOperation({ detail: error instanceof Error ? error.message : "External import failed.", entityName: params.entityKey, externalBulkApiSessionId: access.externalBulkApiSessionId, operation: "IMPORT", recordCount: 0, result: "FAILED" });
          return Response.json({ error: "External import failed validation or persistence." }, { status: 400 });
        }
      },
    },
  },
});
