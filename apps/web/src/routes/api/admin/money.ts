import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../server/access";
import { getDatabase } from "../../../server/database";

export const Route = createFileRoute("/api/admin/money")({ server: { handlers: { GET: async ({ request }) => { try { await requireAdministration(request); const rows = await getDatabase().moneyTransaction.findMany({ orderBy: { recordedAt: "desc" }, take: 500, include: { party: { include: { user: { select: { email: true, name: true } } } }, worldInstance: true } }); return Response.json({ transactions: rows.map((row) => ({ ...row, occurredAtGameMinute: row.occurredAtGameMinute.toString() })) }); } catch (error) { if (error instanceof Response) return error; throw error; } } } } });
