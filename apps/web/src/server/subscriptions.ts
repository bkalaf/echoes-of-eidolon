import { randomUUID } from "node:crypto";

import type Stripe from "stripe";

import { planMembershipGrant, projectMembershipEntitlement, subscriptionPriceCents } from "../domain/membership";
import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";
import { getPayments } from "./payments";

type Database = PrismaClient;
type Transaction = Parameters<Parameters<Database["$transaction"]>[0]>[0];

function reference(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function appendSubscriptionMonth(
  transaction: Transaction,
  input: { occurredAt: Date; sourceReference: string; userId: string },
) {
  const grants = await transaction.membershipGrant.findMany({
    where: { userId: input.userId },
    include: { revocations: { select: { effectiveEndAfter: true } } },
  });
  const current = projectMembershipEntitlement(grants, input.occurredAt);
  const anchor = grants.find((grant) => grant.effectiveEndAt.getTime() === current.effectiveEndAt?.getTime())?.anchorDay;
  const window = planMembershipGrant(input.occurredAt, 1, current.effectiveEndAt, anchor);
  await transaction.membershipGrant.create({
    data: {
      ...window,
      amountCents: subscriptionPriceCents,
      membershipGrantId: randomUUID(),
      source: "SUBSCRIPTION",
      sourceReference: input.sourceReference,
      userId: input.userId,
    },
  });
}

export async function createSubscriptionCheckout(
  input: { email: string; userId: string },
  database: Database = getDatabase(),
) {
  const membershipSubscriptionId = randomUUID();
  await database.membershipSubscription.create({
    data: { membershipSubscriptionId, providerStatus: "PENDING", userId: input.userId },
  });
  try {
    const baseUrl = process.env.BETTER_AUTH_URL;
    if (!baseUrl) throw new Error("BETTER_AUTH_URL is required for subscription checkout.");
    const checkout = await getPayments().checkout.sessions.create({
      cancel_url: `${baseUrl}/account/subscription?state=ACC007`,
      customer_email: input.email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: "Echoes of Eidolon optional Member subscription" },
          recurring: { interval: "month" },
          unit_amount: subscriptionPriceCents,
        },
        quantity: 1,
      }],
      metadata: { membershipSubscriptionId },
      mode: "subscription",
      subscription_data: { metadata: { membershipSubscriptionId } },
      success_url: `${baseUrl}/account/subscription?state=ACC006&session_id={CHECKOUT_SESSION_ID}`,
    });
    if (!checkout.url) throw new Error("Stripe did not return a hosted subscription checkout URL.");
    await database.membershipSubscription.update({
      where: { membershipSubscriptionId },
      data: { stripeCheckoutReference: checkout.id },
    });
    return { checkoutUrl: checkout.url, membershipSubscriptionId };
  } catch (error) {
    await database.membershipSubscription.update({
      where: { membershipSubscriptionId },
      data: { providerStatus: "FAILED" },
    });
    throw error;
  }
}

export async function getSubscriptionState(userId: string, database: Database = getDatabase()) {
  return database.membershipSubscription.findFirst({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { membershipSubscriptionId: "asc" }],
    select: {
      cancelAtPeriodEnd: true,
      canceledAt: true,
      currentPeriodEndAt: true,
      currentPeriodStartAt: true,
      events: {
        orderBy: [{ occurredAt: "desc" }, { membershipSubscriptionEventId: "asc" }],
        select: { eventType: true, occurredAt: true, providerStatus: true },
      },
      membershipSubscriptionId: true,
      providerStatus: true,
      stripeCheckoutReference: true,
      stripeCustomerReference: true,
      stripeSubscriptionReference: true,
    },
  });
}

export async function cancelSubscriptionRenewal(userId: string, database: Database = getDatabase()) {
  const subscription = await getSubscriptionState(userId, database);
  if (!subscription?.stripeSubscriptionReference) throw new Error("No active Stripe subscription is available to cancel.");
  if (subscription.cancelAtPeriodEnd) return subscription;
  const provider = await getPayments().subscriptions.update(subscription.stripeSubscriptionReference, {
    cancel_at_period_end: true,
  });
  await database.membershipSubscription.update({
    where: { membershipSubscriptionId: subscription.membershipSubscriptionId },
    data: { cancelAtPeriodEnd: provider.cancel_at_period_end },
  });
  return getSubscriptionState(userId, database);
}

export async function createSubscriptionPortal(userId: string, database: Database = getDatabase()) {
  const subscription = await getSubscriptionState(userId, database);
  if (!subscription?.stripeCustomerReference) throw new Error("No Stripe customer is available for payment-method management.");
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) throw new Error("BETTER_AUTH_URL is required for the Stripe Customer Portal.");
  const portal = await getPayments().billingPortal.sessions.create({
    customer: subscription.stripeCustomerReference,
    return_url: `${baseUrl}/account/subscription?state=ACC008`,
  });
  return { portalUrl: portal.url };
}

async function recordProviderEvent(transaction: Transaction, input: {
  eventType: string;
  membershipSubscriptionId: string;
  occurredAt: Date;
  providerStatus: string;
  stripeEventId: string;
  currentPeriodStartAt?: Date | null;
  currentPeriodEndAt?: Date | null;
}) {
  await transaction.membershipSubscriptionEvent.create({
    data: { ...input, membershipSubscriptionEventId: randomUUID() },
  });
}

async function resolveProviderSubscription(
  transaction: Transaction,
  input: { membershipSubscriptionId?: string; stripeCustomerReference?: string | null; stripeSubscriptionReference: string },
) {
  let subscription = await transaction.membershipSubscription.findUnique({ where: { stripeSubscriptionReference: input.stripeSubscriptionReference } });
  if (!subscription && input.membershipSubscriptionId) {
    subscription = await transaction.membershipSubscription.findUnique({ where: { membershipSubscriptionId: input.membershipSubscriptionId } });
    if (!subscription) return null;
    if (subscription.stripeSubscriptionReference && subscription.stripeSubscriptionReference !== input.stripeSubscriptionReference) {
      throw new Error("Stripe subscription identity conflicts with the server-owned subscription record.");
    }
    await transaction.membershipSubscription.update({
      where: { membershipSubscriptionId: subscription.membershipSubscriptionId },
      data: {
        stripeCustomerReference: input.stripeCustomerReference ?? subscription.stripeCustomerReference,
        stripeSubscriptionReference: input.stripeSubscriptionReference,
      },
    });
  }
  return subscription;
}

export async function processSubscriptionStripeEvent(event: Stripe.Event, transaction: Transaction) {
  const occurredAt = new Date(event.created * 1_000);
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const membershipSubscriptionId = session.metadata?.membershipSubscriptionId;
    if (!membershipSubscriptionId || session.mode !== "subscription") return false;
    const subscription = await transaction.membershipSubscription.findUnique({ where: { membershipSubscriptionId } });
    if (!subscription || subscription.stripeCheckoutReference !== session.id) throw new Error("Subscription checkout does not match the server-owned record.");
    const stripeSubscriptionReference = reference(session.subscription);
    if (!stripeSubscriptionReference || session.payment_status !== "paid") throw new Error("Subscription checkout is not authoritatively paid.");
    await transaction.membershipSubscription.update({
      where: { membershipSubscriptionId },
      data: {
        providerStatus: "ACTIVE",
        stripeCustomerReference: reference(session.customer),
        stripeSubscriptionReference,
      },
    });
    await recordProviderEvent(transaction, {
      eventType: event.type,
      membershipSubscriptionId,
      occurredAt,
      providerStatus: "ACTIVE",
      stripeEventId: event.id,
    });
    // The checkout event establishes the server-owned subscription identity.
    // Member time is granted only by invoice.paid so Stripe's normal pair of
    // lifecycle events cannot count the initial billing cycle twice.
    return true;
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const looseInvoice = invoice as Stripe.Invoice & {
      subscription?: string | { id: string } | null;
      parent?: { subscription_details?: { metadata?: Record<string, string>; subscription?: string | { id: string } | null } | null } | null;
    };
    const stripeSubscriptionReference = reference(looseInvoice.subscription)
      ?? reference(invoice.parent?.subscription_details?.subscription);
    if (!stripeSubscriptionReference) return false;
    const subscription = await resolveProviderSubscription(transaction, {
      membershipSubscriptionId: looseInvoice.parent?.subscription_details?.metadata?.membershipSubscriptionId,
      stripeCustomerReference: reference(invoice.customer),
      stripeSubscriptionReference,
    });
    if (!subscription) return false;
    await recordProviderEvent(transaction, {
      eventType: event.type,
      membershipSubscriptionId: subscription.membershipSubscriptionId,
      occurredAt,
      providerStatus: "ACTIVE",
      stripeEventId: event.id,
    });
    await transaction.membershipSubscription.update({
      where: { membershipSubscriptionId: subscription.membershipSubscriptionId },
      data: { providerStatus: "ACTIVE" },
    });
    await appendSubscriptionMonth(transaction, { occurredAt, sourceReference: event.id, userId: subscription.userId });
    return true;
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const provider = event.data.object as Stripe.Subscription;
    const subscription = await resolveProviderSubscription(transaction, {
      membershipSubscriptionId: provider.metadata?.membershipSubscriptionId,
      stripeCustomerReference: reference(provider.customer),
      stripeSubscriptionReference: provider.id,
    });
    if (!subscription) return false;
    const providerStatus = event.type === "customer.subscription.deleted" ? "CANCELED" : provider.status.toUpperCase();
    await transaction.membershipSubscription.update({
      where: { membershipSubscriptionId: subscription.membershipSubscriptionId },
      data: {
        canceledAt: event.type === "customer.subscription.deleted" ? occurredAt : subscription.canceledAt,
        cancelAtPeriodEnd: provider.cancel_at_period_end,
        providerStatus,
      },
    });
    await recordProviderEvent(transaction, {
      eventType: event.type,
      membershipSubscriptionId: subscription.membershipSubscriptionId,
      occurredAt,
      providerStatus,
      stripeEventId: event.id,
    });
    return true;
  }
  return false;
}
