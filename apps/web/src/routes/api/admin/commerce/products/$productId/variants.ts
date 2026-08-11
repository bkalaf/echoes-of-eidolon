import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../../../server/access";
import { CommerceAdminConflictError, CommerceAdminNotFoundError, saveStoreVariant, saveStoreVariantSchema } from "../../../../../../server/commerce-admin";

export const Route = createFileRoute("/api/admin/commerce/products/$productId/variants")({
  server: { handlers: { PUT: async ({ params, request }) => {
    try {
      await requireAdministration(request);
      return Response.json({ variant: await saveStoreVariant(params.productId, saveStoreVariantSchema.parse(await request.json())) });
    } catch (error) {
      if (error instanceof Response) return error;
      if (error instanceof CommerceAdminNotFoundError) return Response.json({ error: error.message }, { status: 404 });
      if (error instanceof z.ZodError || error instanceof CommerceAdminConflictError) return Response.json({ error: error instanceof Error ? error.message : "Invalid variant." }, { status: 400 });
      throw error;
    }
  } } },
});
