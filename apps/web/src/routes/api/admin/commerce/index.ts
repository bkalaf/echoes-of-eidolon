import { createFileRoute } from "@tanstack/react-router";

import { requireAdministration } from "../../../../server/access";
import { getDatabase } from "../../../../server/database";

export const Route = createFileRoute("/api/admin/commerce/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdministration(request);
          const [products, orders] = await Promise.all([
            getDatabase().storeProduct.findMany({
              orderBy: { storeProductId: "asc" },
              select: {
                active: true,
                artworkAssetId: true,
                name: true,
                storeProductId: true,
                variants: {
                  orderBy: { storeVariantId: "asc" },
                  select: {
                    available: true,
                    color: true,
                    priceCents: true,
                    printfulVariantReference: true,
                    size: true,
                    storeVariantId: true,
                    stripePriceReference: true,
                  },
                },
              },
            }),
            getDatabase().order.findMany({
              orderBy: [{ createdAt: "desc" }, { orderId: "asc" }],
              select: {
                createdAt: true,
                lines: {
                  orderBy: { orderLineId: "asc" },
                  select: {
                    quantity: true,
                    storeVariant: {
                      select: {
                        color: true,
                        size: true,
                        storeProduct: { select: { name: true } },
                        storeVariantId: true,
                      },
                    },
                    unitPriceCents: true,
                  },
                },
                orderId: true,
                paymentConfirmation: {
                  select: {
                    amountCents: true,
                    confirmedAt: true,
                    fulfillment: { select: { submittedAt: true } },
                  },
                },
                refunds: { select: { amountCents: true, refundedAt: true } },
                returnEligibility: { select: { eligibleAt: true } },
                user: { select: { email: true, id: true } },
              },
            }),
          ]);
          return Response.json({
            orders: orders.map((order) => ({
              ...order,
              refundedAmountCents: order.refunds.reduce((sum, refund) => sum + refund.amountCents, 0),
            })),
            products: products.map((product) => ({
              ...product,
              variants: product.variants.map(({ printfulVariantReference, stripePriceReference, ...variant }) => ({
                ...variant,
                printfulConfigured: Boolean(printfulVariantReference),
                stripeConfigured: Boolean(stripePriceReference),
              })),
            })),
          });
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    },
  },
});
