import { randomUUID } from "node:crypto";
import { z } from "zod";

import { resolveAuthoritativeCheckoutLine } from "../domain/commerce";
import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";
import { getPayments, getStoreShippingCountries } from "./payments";

type Database = PrismaClient;

export const storeCheckoutInputSchema = z.object({
  lines: z.array(z.object({ quantity: z.int().min(1).max(20), storeVariantId: z.string().min(1) }).strict()).min(1).max(50),
}).strict();

export async function getPublicCatalog(database: Database = getDatabase()) {
  return database.storeProduct.findMany({
    where: { active: true, variants: { some: { available: true } } },
    orderBy: { name: "asc" },
    select: {
      artworkAsset: { select: { purposeLinks: { select: { purpose: true } } } },
      name: true,
      productType: true,
      storeProductId: true,
      variants: { where: { available: true }, orderBy: { storeVariantId: "asc" }, select: { color: true, priceCents: true, size: true, storeVariantId: true } },
    },
  });
}

export async function createStoreCheckout(input: { email: string; lines: z.infer<typeof storeCheckoutInputSchema>["lines"]; userId: string }, database: Database = getDatabase()) {
  const ids = [...new Set(input.lines.map((line) => line.storeVariantId))];
  const variants = await database.storeVariant.findMany({ where: { storeVariantId: { in: ids } } });
  const lines = input.lines.map((line) => resolveAuthoritativeCheckoutLine(line, variants));
  const orderId = randomUUID();
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) throw new Error("BETTER_AUTH_URL is required for Store checkout.");
  const checkout = await getPayments().checkout.sessions.create({
    cancel_url: `${baseUrl}/store/checkout/declined?session_id={CHECKOUT_SESSION_ID}`,
    client_reference_id: orderId,
    customer_email: input.email,
    line_items: lines.map((line) => ({ price: line.stripePriceReference, quantity: line.quantity })),
    metadata: { orderId },
    mode: "payment",
    shipping_address_collection: { allowed_countries: getStoreShippingCountries() },
    success_url: `${baseUrl}/store/checkout/approved?session_id={CHECKOUT_SESSION_ID}`,
  });
  try {
    await database.order.create({
      data: {
        orderId,
        stripeCheckoutReference: checkout.id,
        userId: input.userId,
        lines: { create: lines.map((line) => ({ orderLineId: randomUUID(), quantity: line.quantity, storeVariantId: line.storeVariantId, unitPriceCents: line.unitPriceCents })) },
      },
    });
  } catch (error) {
    await getPayments().checkout.sessions.expire(checkout.id);
    throw error;
  }
  if (!checkout.url) throw new Error("Stripe did not return a hosted Store checkout URL.");
  return { checkoutUrl: checkout.url, orderId };
}

export async function getStoreCheckoutStatus(input: { checkoutReference: string; userId: string }, database: Database = getDatabase()) {
  const order = await database.order.findFirst({
    where: { stripeCheckoutReference: input.checkoutReference, userId: input.userId },
    select: {
      createdAt: true,
      lines: {
        orderBy: { orderLineId: "asc" },
        select: {
          orderLineId: true,
          quantity: true,
          storeVariant: { select: { color: true, size: true, storeProduct: { select: { name: true } } } },
          unitPriceCents: true,
        },
      },
      orderId: true,
      paymentConfirmation: {
        select: { amountCents: true, confirmedAt: true, fulfillment: { select: { submittedAt: true } } },
      },
    },
  });
  if (!order) return null;
  return {
    createdAt: order.createdAt,
    lines: order.lines.map((line) => ({
      color: line.storeVariant.color,
      name: line.storeVariant.storeProduct.name,
      orderLineId: line.orderLineId,
      quantity: line.quantity,
      size: line.storeVariant.size,
      unitPriceCents: line.unitPriceCents,
    })),
    orderId: order.orderId,
    payment: order.paymentConfirmation ? {
      amountCents: order.paymentConfirmation.amountCents,
      confirmedAt: order.paymentConfirmation.confirmedAt,
      fulfillmentSubmittedAt: order.paymentConfirmation.fulfillment?.submittedAt ?? null,
    } : null,
  };
}

export async function confirmStoreCheckout(input: { amountTotal: number | null; checkoutReference: string; orderId: string; stripeWebhookEventId: string }, transaction: Parameters<Parameters<Database["$transaction"]>[0]>[0]) {
  const order = await transaction.order.findUnique({ where: { orderId: input.orderId }, include: { lines: true, paymentConfirmation: true } });
  if (!order || order.paymentConfirmation) return;
  const expectedAmount = order.lines.reduce((total, line) => total + line.quantity * line.unitPriceCents, 0);
  if (order.stripeCheckoutReference !== input.checkoutReference || expectedAmount !== input.amountTotal) throw new Error("Store checkout confirmation does not match the server-owned order.");
  await transaction.orderPaymentConfirmation.create({ data: { amountCents: expectedAmount, confirmedAt: new Date(), orderId: order.orderId, orderPaymentConfirmationId: randomUUID(), stripeWebhookEventId: input.stripeWebhookEventId } });
}
