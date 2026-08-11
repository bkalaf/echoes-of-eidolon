import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireServerSession } from "../../../server/access";
import { createStoreCheckout, storeCheckoutInputSchema } from "../../../server/storefront";

export const Route = createFileRoute("/api/store/checkout")({ server: { handlers: { POST: async ({ request }) => { try { const access = await requireServerSession(request); const input = storeCheckoutInputSchema.parse(await request.json()); return Response.json(await createStoreCheckout({ ...input, email: access.email, userId: access.userId }), { status: 201 }); } catch (error) { if (error instanceof Response) return error; if (error instanceof z.ZodError || (error instanceof Error && /unavailable/.test(error.message))) return Response.json({ error: error instanceof Error ? error.message : "Valid configured Store lines are required." }, { status: 400 }); throw error; } } } } });
