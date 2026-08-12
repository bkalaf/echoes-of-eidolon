import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { requireAdministration } from "../../../server/access";
import { getDatabase } from "../../../server/database";

const inputSchema = z.object({ settlementId: z.string().min(1), soundtrackId: z.string().min(1), category: z.enum(["CITY", "TAVERN"]), ordinal: z.number().int().nonnegative(), active: z.boolean() }).strict();

export const Route = createFileRoute("/api/admin/settlement-soundtracks")({ server: { handlers: {
  GET: async ({ request }) => { try { await requireAdministration(request); const settlementId = new URL(request.url).searchParams.get("settlementId") ?? ""; const database = getDatabase(); const [settlement, soundtracks] = await Promise.all([database.settlement.findUnique({ where: { settlementId }, include: { soundtrackAssignments: { orderBy: [{ category: "asc" }, { ordinal: "asc" }], include: { soundtrack: true } } } }), database.soundtrack.findMany({ orderBy: { displayName: "asc" } })]); return settlement ? Response.json({ settlement, soundtracks }) : Response.json({ error: "Settlement not found." }, { status: 404 }); } catch (error) { if (error instanceof Response) return error; throw error; } },
  PUT: async ({ request }) => { try { await requireAdministration(request); const input = inputSchema.parse(await request.json()); const assignment = await getDatabase().settlementSoundtrackAssignment.upsert({ where: { settlementId_soundtrackId_category: { settlementId: input.settlementId, soundtrackId: input.soundtrackId, category: input.category } }, create: { settlementSoundtrackAssignmentId: randomUUID(), ...input }, update: { active: input.active, ordinal: input.ordinal } }); return Response.json({ assignment }); } catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Soundtrack assignment is invalid." }, { status: 400 }); return Response.json({ error: "Soundtrack assignment could not be saved." }, { status: 409 }); } },
} } });
