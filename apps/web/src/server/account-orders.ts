import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";

const accountOrderSelection = {
  createdAt: true,
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
} satisfies Prisma.OrderSelect;

type AccountOrderRecord = Prisma.OrderGetPayload<{ select: typeof accountOrderSelection }>;

function projectAccountOrder(order: AccountOrderRecord) {
  return {
    createdAt: order.createdAt.toISOString(),
    lines: order.lines.map((line) => ({
      color: line.storeVariant.color,
      name: line.storeVariant.storeProduct.name,
      orderLineId: line.orderLineId,
      quantity: line.quantity,
      size: line.storeVariant.size,
      storeVariantId: line.storeVariant.storeVariantId,
      unitPriceCents: line.unitPriceCents,
    })),
    orderId: order.orderId,
    payment: order.paymentConfirmation ? {
      amountCents: order.paymentConfirmation.amountCents,
      confirmedAt: order.paymentConfirmation.confirmedAt.toISOString(),
      fulfillmentSubmittedAt: order.paymentConfirmation.fulfillment?.submittedAt.toISOString() ?? null,
    } : null,
    refunds: order.refunds.map((refund) => ({
      amountCents: refund.amountCents,
      refundedAt: refund.refundedAt.toISOString(),
    })),
    returnEligibleAt: order.returnEligibility?.eligibleAt.toISOString() ?? null,
  };
}

export async function listAccountOrders(userId: string, database: PrismaClient = getDatabase()) {
  const orders = await database.order.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { orderId: "asc" }],
    select: accountOrderSelection,
  });
  return orders.map(projectAccountOrder);
}

export async function getAccountOrder(orderId: string, userId: string, database: PrismaClient = getDatabase()) {
  const order = await database.order.findFirst({
    where: { orderId, userId },
    select: accountOrderSelection,
  });
  return order ? projectAccountOrder(order) : null;
}
