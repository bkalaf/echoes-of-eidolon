import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../../server/access";
import { CommerceAdminConflictError, CommerceAdminNotFoundError, updateStoreProduct, updateStoreProductSchema } from "../../../../../server/commerce-admin";

export const Route = createFileRoute("/api/admin/commerce/products/$productId")({
  server: { handlers: { PATCH: async ({ params, request }) => {
    try {
      await requireAdministration(request);
      return Response.json({ product: await updateStoreProduct(params.productId, updateStoreProductSchema.parse(await request.json())) });
    } catch (error) {
      if (error instanceof Response) return error;
      if (error instanceof CommerceAdminNotFoundError) return Response.json({ error: error.message }, { status: 404 });
      if (error instanceof z.ZodError || error instanceof CommerceAdminConflictError) return Response.json({ error: error instanceof Error ? error.message : "Invalid product." }, { status: 400 });
      throw error;
    }
  } } },
});
