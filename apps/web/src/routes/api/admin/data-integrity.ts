import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../server/access";
import { getDatabase } from "../../../server/database";
import { collectWorldbuildingIntegrityIssues } from "../../../server/worldbuilding-integrity";

export const Route = createFileRoute("/api/admin/data-integrity")({ server: { handlers: { GET: async ({ request }) => {
  try {
    await requireAdministration(request);
    const issues = await collectWorldbuildingIntegrityIssues(getDatabase());
    return Response.json({ issues });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "WorldBuilding integrity could not be evaluated." }, { status: 500 });
  }
} } } });
