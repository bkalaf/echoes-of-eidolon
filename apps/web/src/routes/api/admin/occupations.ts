import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../server/access";
import { getDatabase } from "../../../server/database";

const ability = z.enum(["CHARISMA", "DEXTERITY", "INTELLIGENCE", "STAMINA", "STRENGTH", "WISDOM"]);
const inputSchema = z.object({ occupationId: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/), name: z.string().trim().min(1).max(200), description: z.string().trim().max(2_000).nullable(), active: z.boolean(), attributeAffinity: z.array(ability).min(1).max(6).refine((values) => new Set(values).size === values.length) }).strict();

export const Route = createFileRoute("/api/admin/occupations")({ server: { handlers: {
  GET: async ({ request }) => { try { await requireAdministration(request); return Response.json({ occupations: await getDatabase().occupation.findMany({ include: { affinities: { orderBy: { ordinal: "asc" } } }, orderBy: { name: "asc" } }) }); } catch (error) { if (error instanceof Response) return error; throw error; } },
  PUT: async ({ request }) => { try { await requireAdministration(request); const input = inputSchema.parse(await request.json()); const occupation = await getDatabase().$transaction(async (transaction) => { await transaction.occupation.upsert({ where: { occupationId: input.occupationId }, create: { occupationId: input.occupationId, name: input.name, description: input.description, active: input.active }, update: { name: input.name, description: input.description, active: input.active } }); await transaction.occupationAttributeAffinity.deleteMany({ where: { occupationId: input.occupationId } }); await transaction.occupationAttributeAffinity.createMany({ data: input.attributeAffinity.map((abilityType, ordinal) => ({ occupationId: input.occupationId, abilityType, ordinal })) }); return transaction.occupation.findUniqueOrThrow({ where: { occupationId: input.occupationId }, include: { affinities: { orderBy: { ordinal: "asc" } } } }); }); return Response.json({ occupation }); } catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Occupation authoring fields are invalid." }, { status: 400 }); return Response.json({ error: "Occupation could not be saved." }, { status: 409 }); } },
} } });
