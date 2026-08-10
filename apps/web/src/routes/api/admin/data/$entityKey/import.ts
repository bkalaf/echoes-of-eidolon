import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdminCapability } from "../../../../../server/access";
import { getDatabase } from "../../../../../server/database";
import {
  applyDefinitionImport,
  applyLessonImport,
  applyLegendaryRewardImport,
  applyTimelineEventImport,
  applyInterludeImport,
  applyArkImport,
  applyLayetteImport,
  applySoulImport,
  CanonicalImportDriftError,
  UnsupportedImportEntityError,
} from "../../../../../server/soul-import";

const requestSchema = z.object({ rows: z.array(z.unknown()) }).strict();

export const Route = createFileRoute("/api/admin/data/$entityKey/import")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        try {
          await requireAdminCapability(request, "operateBulkApi");
          const input = requestSchema.parse(await request.json());
          const database = getDatabase();
          let result: { changed: number; unchanged: number };
          if (params.entityKey === "soul") {
            result = await applySoulImport(input.rows, {
              transaction: (work) => database.$transaction((transaction) => work(transaction)),
            });
          } else if (params.entityKey === "definition") {
            result = await applyDefinitionImport(input.rows, {
              transaction: (work) => database.$transaction((transaction) => work(transaction)),
            });
          } else if (params.entityKey === "lesson") {
            result = await applyLessonImport(input.rows, {
              transaction: (work) => database.$transaction((transaction) => work(transaction)),
            });
          } else if (params.entityKey === "legendaryreward") {
            result = await applyLegendaryRewardImport(input.rows, {
              transaction: (work) => database.$transaction((transaction) => work(transaction)),
            });
          } else if (params.entityKey === "timelineevent") {
            result = await applyTimelineEventImport(input.rows, {
              transaction: (work) => database.$transaction((transaction) => work(transaction)),
            });
          } else if (params.entityKey === "interlude") {
            result = await applyInterludeImport(input.rows, {
              transaction: (work) => database.$transaction((transaction) => work(transaction)),
            });
          } else if (params.entityKey === "ark") {
            result = await applyArkImport(input.rows, {
              transaction: (work) => database.$transaction((transaction) => work(transaction)),
            });
          } else if (params.entityKey === "layette") {
            result = await applyLayetteImport(input.rows, {
              transaction: (work) => database.$transaction((transaction) => work(transaction)),
            });
          } else {
            throw new UnsupportedImportEntityError(`Typed import is unavailable for entity key ${params.entityKey}.`);
          }
          return Response.json(result);
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof UnsupportedImportEntityError) {
            return Response.json({ error: error.message }, { status: 404 });
          }
          if (error instanceof CanonicalImportDriftError) {
            return Response.json({ error: error.message }, { status: 409 });
          }
          if (error instanceof z.ZodError || error instanceof SyntaxError) {
            return Response.json({ error: "Import rows or fields are invalid." }, { status: 400 });
          }
          if (error instanceof Error && error.message.startsWith("Import duplicates soulId")) {
            return Response.json({ error: error.message }, { status: 400 });
          }
          return Response.json({ error: "Import could not be applied." }, { status: 400 });
        }
      },
    },
  },
});
