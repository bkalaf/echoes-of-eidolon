import { createFileRoute } from "@tanstack/react-router";
import { getPublicCatalog } from "../../../server/storefront";

export const Route = createFileRoute("/api/store/catalog")({ server: { handlers: { GET: async () => Response.json({ products: await getPublicCatalog() }) } } });
