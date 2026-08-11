import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { getAuthEnv } from "./env";
import { getDatabase } from "./database";
import { sendOrderStatusLink } from "./email";

type Database = PrismaClient;
type Transaction = Parameters<Parameters<Database["$transaction"]>[0]>[0];

const tokenLifetimeMs = 30 * 24 * 60 * 60 * 1_000;
const lookupWindowMs = 15 * 60 * 1_000;
const lookupLimit = 5;
const lookupAttempts = new Map<string, number[]>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function emailHash(email: string): string {
  return createHmac("sha256", getAuthEnv().BETTER_AUTH_SECRET).update(normalizeEmail(email)).digest("hex");
}

export function assertGuestLookupRateLimit(key: string, now = Date.now()) {
  const recent = (lookupAttempts.get(key) ?? []).filter((attempt) => now - attempt < lookupWindowMs);
  if (recent.length >= lookupLimit) throw new Response("Too many order lookup attempts.", { status: 429 });
  recent.push(now);
  lookupAttempts.set(key, recent);
}

export function issueOrderAccessTokenData(orderId: string, email: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    data: {
      createdAt: now,
      emailHash: emailHash(email),
      expiresAt: new Date(now.getTime() + tokenLifetimeMs),
      orderId,
      orderPublicAccessTokenId: randomUUID(),
      tokenHash: tokenHash(token),
    },
  };
}

export async function issueOrderAccessToken(
  orderId: string,
  email: string,
  transaction: Transaction,
) {
  const issued = issueOrderAccessTokenData(orderId, email);
  await transaction.orderPublicAccessToken.create({ data: issued.data });
  return issued.token;
}

const publicOrderSelection = {
  contactEmail: true,
  createdAt: true,
  lines: {
    orderBy: { orderLineId: "asc" as const },
    select: {
      orderLineId: true,
      quantity: true,
      storeVariant: { select: { color: true, size: true, storeProduct: { select: { name: true } } } },
      unitPriceCents: true,
    },
  },
  orderId: true,
  paymentConfirmation: { select: { amountCents: true, confirmedAt: true, fulfillment: { select: { submittedAt: true } } } },
  refunds: { orderBy: { refundedAt: "asc" as const }, select: { amountCents: true, refundedAt: true } },
  shippingSummary: true,
} satisfies Prisma.OrderSelect;

export async function getPublicOrder(publicOrderToken: string, database: Database = getDatabase()) {
  const access = await database.orderPublicAccessToken.findUnique({
    where: { tokenHash: tokenHash(publicOrderToken) },
    select: { emailHash: true, expiresAt: true, revokedAt: true, order: { select: publicOrderSelection } },
  });
  if (!access || access.revokedAt || access.expiresAt <= new Date() || access.emailHash !== emailHash(access.order.contactEmail)) return null;
  const order = access.order;
  return {
    createdAt: order.createdAt.toISOString(),
    items: order.lines.map((line) => ({
      color: line.storeVariant.color,
      name: line.storeVariant.storeProduct.name,
      orderLineId: line.orderLineId,
      quantity: line.quantity,
      size: line.storeVariant.size,
      unitPriceCents: line.unitPriceCents,
    })),
    orderId: order.orderId,
    payment: order.paymentConfirmation ? { amountCents: order.paymentConfirmation.amountCents, confirmedAt: order.paymentConfirmation.confirmedAt.toISOString() } : null,
    fulfillment: order.paymentConfirmation?.fulfillment ? { submittedAt: order.paymentConfirmation.fulfillment.submittedAt.toISOString() } : null,
    refundedAmountCents: order.refunds.reduce((sum, refund) => sum + refund.amountCents, 0),
    shippingSummary: order.shippingSummary,
  };
}

export async function authorizePublicOrderToken(publicOrderToken: string, database: Database = getDatabase()) {
  const access = await database.orderPublicAccessToken.findUnique({
    where: { tokenHash: tokenHash(publicOrderToken) },
    select: { emailHash: true, expiresAt: true, revokedAt: true, order: { select: { contactEmail: true, orderId: true } } },
  });
  if (!access || access.revokedAt || access.expiresAt <= new Date() || access.emailHash !== emailHash(access.order.contactEmail)) return null;
  return access.order;
}

export async function requestOrderStatusLink(input: {
  email: string;
  orderId: string;
  rateLimitKey: string;
}, database: Database = getDatabase()) {
  assertGuestLookupRateLimit(input.rateLimitKey);
  const normalized = normalizeEmail(input.email);
  const order = await database.order.findFirst({
    where: { contactEmail: { equals: normalized, mode: "insensitive" }, orderId: input.orderId },
    select: { contactEmail: true, orderId: true },
  });
  if (order) {
    const token = await database.$transaction((transaction) => issueOrderAccessToken(order.orderId, order.contactEmail, transaction));
    const baseUrl = process.env.BETTER_AUTH_URL;
    if (!baseUrl) throw new Error("BETTER_AUTH_URL is required for order-status links.");
    try {
      await sendOrderStatusLink({ recipient: order.contactEmail, url: `${baseUrl}/store/orders/${token}` });
    } catch {
      // The public response must not reveal whether an order/email combination
      // matched by changing shape when the delivery provider is unavailable.
    }
  }
  return { accepted: true } as const;
}
