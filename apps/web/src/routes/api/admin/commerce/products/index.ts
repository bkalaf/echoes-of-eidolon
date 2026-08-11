import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../../server/access";
import { CommerceAdminConflictError, createStoreProduct, createStoreProductSchema } from "../../../../../server/commerce-admin";

export const Route = createFileRoute("/api/admin/commerce/products/")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      await requireAdministration(request);
      return Response.json({ product: await createStoreProduct(createStoreProductSchema.parse(await request.json())) }, { status: 201 });
    } catch (error) {
      if (error instanceof Response) return error;
      if (error instanceof z.ZodError || error instanceof CommerceAdminConflictError) return Response.json({ error: error instanceof Error ? error.message : "Invalid product." }, { status: 400 });
      throw error;
    }
  } } },
});
