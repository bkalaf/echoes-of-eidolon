import { createFileRoute } from "@tanstack/react-router";

import { storeProductTypes } from "../../../../domain/store";
import { requireAdministration } from "../../../../server/access";
import { getDatabase } from "../../../../server/database";

export const Route = createFileRoute("/api/admin/commerce/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdministration(request);
          const [products, orders, donations, subscriptions, managedAssets] = await Promise.all([
            getDatabase().storeProduct.findMany({
              orderBy: { storeProductId: "asc" },
              select: {
                active: true,
                artworkAssetId: true,
                name: true,
                productType: true,
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
                contactEmail: true,
                createdAt: true,
                helpTickets: {
                  orderBy: [{ updatedAt: "desc" }, { helpTicketId: "asc" }],
                  select: { categoryKey: true, channel: true, helpTicketId: true, status: true, subject: true, updatedAt: true },
                },
                lines: {
                  orderBy: { orderLineId: "asc" },
                  select: {
                    orderLineId: true,
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
                refunds: {
                  orderBy: [{ refundedAt: "asc" }, { orderRefundId: "asc" }],
                  select: { amountCents: true, refundedAt: true },
                },
                returnEligibility: { select: { eligibleAt: true } },
                returnRequest: { select: { helpTicketId: true, submittedAt: true } },
                user: { select: { email: true, id: true } },
              },
            }),
            getDatabase().donationCheckout.findMany({
              orderBy: [{ createdAt: "desc" }, { donationCheckoutId: "asc" }],
              select: {
                amountCents: true,
                confirmedAt: true,
                createdAt: true,
                donationCheckoutId: true,
                monthsGranted: true,
                status: true,
                stripeCheckoutReference: true,
                user: { select: { email: true, id: true } },
              },
            }),
            getDatabase().membershipSubscription.findMany({
              orderBy: [{ updatedAt: "desc" }, { membershipSubscriptionId: "asc" }],
              select: {
                cancelAtPeriodEnd: true,
                canceledAt: true,
                createdAt: true,
                currentPeriodEndAt: true,
                currentPeriodStartAt: true,
                events: { orderBy: [{ occurredAt: "desc" }, { membershipSubscriptionEventId: "asc" }], select: { eventType: true, occurredAt: true, providerStatus: true } },
                membershipSubscriptionId: true,
                providerStatus: true,
                updatedAt: true,
                user: { select: { email: true, id: true } },
              },
            }),
            getDatabase().managedAsset.findMany({
              orderBy: { managedAssetId: "asc" },
              select: { managedAssetId: true, objectKey: true },
              where: { mediaKind: "IMAGE" },
            }),
          ]);
          const categoryCounts = new Map(products.map((product) => [product.productType, product]));
          return Response.json({
            categories: storeProductTypes.map((category) => {
              const product = categoryCounts.get(category.productType);
              return {
                activeItems: product?.active ? 1 : 0,
                categoryPath: category.categoryPath,
                items: product ? 1 : 0,
                name: category.name,
                productType: category.productType,
              };
            }),
            donations: donations.map(({ stripeCheckoutReference, ...donation }) => ({
              ...donation,
              stripeConfigured: Boolean(stripeCheckoutReference),
            })),
            managedAssets,
            orders: orders.map((order) => ({
              ...order,
              refundedAmountCents: order.refunds.reduce((sum, refund) => sum + refund.amountCents, 0),
            })),
            products: products.map((product) => ({
              ...product,
              variants: product.variants.map((variant) => ({
                ...variant,
                printfulConfigured: Boolean(variant.printfulVariantReference),
                stripeConfigured: Boolean(variant.stripePriceReference),
              })),
            })),
            subscriptions,
          });
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    },
  },
});
