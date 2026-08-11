import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../../server/access";
import { compareCapabilityProjection } from "../../../../server/capability-ledger";
import { getDatabase } from "../../../../server/database";

export const Route = createFileRoute("/api/admin/capabilities/inspector")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        await requireAdministration(request);
        const url = new URL(request.url);
        const scopeId = url.searchParams.get("scopeId")?.trim() || undefined;
        const capabilityAddressId = url.searchParams.get("capabilityAddressId")?.trim() || undefined;
        const events = await getDatabase().capabilityEvent.findMany({
          where: { ...(scopeId ? { scopeId } : {}), ...(capabilityAddressId ? { capabilityAddressId } : {}) },
          include: {
            capabilityAddress: { include: { capabilityDefinition: true } },
            capabilityDefinitionVersion: true,
          },
          orderBy: { sequence: "asc" },
          take: 250,
        });
        return Response.json({
          comparison: await compareCapabilityProjection(),
          events: events.map((event) => ({ ...event, sequence: event.sequence.toString(), counterValue: event.counterValue?.toString() ?? null })),
        });
      } catch (error) {
        if (error instanceof Response) return error;
        throw error;
      }
    },
  } },
});
