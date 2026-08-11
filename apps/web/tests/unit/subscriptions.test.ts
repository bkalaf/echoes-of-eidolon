import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import { processSubscriptionStripeEvent } from "../../src/server/subscriptions";

function event(type: string, object: unknown, id: string): Stripe.Event {
  return { created: Date.parse("2027-01-31T12:00:00.000Z") / 1_000, data: { object }, id, type } as unknown as Stripe.Event;
}

function transaction() {
  return {
    membershipGrant: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    membershipSubscription: {
      findUnique: vi.fn().mockResolvedValue({
        canceledAt: null,
        membershipSubscriptionId: "MEMSUB-1",
        stripeCheckoutReference: "cs_1",
        userId: "USER-1",
      }),
      update: vi.fn(),
    },
    membershipSubscriptionEvent: { create: vi.fn() },
  };
}

describe("server-owned Stripe subscription lifecycle", () => {
  it("records paid checkout identity but waits for invoice truth before granting Member time", async () => {
    const tx = transaction();
    const handled = await processSubscriptionStripeEvent(event("checkout.session.completed", {
      customer: "cus_1",
      id: "cs_1",
      metadata: { membershipSubscriptionId: "MEMSUB-1" },
      mode: "subscription",
      payment_status: "paid",
      subscription: "sub_1",
    }, "evt_checkout"), tx as never);

    expect(handled).toBe(true);
    expect(tx.membershipSubscription.update).toHaveBeenCalledWith({
      where: { membershipSubscriptionId: "MEMSUB-1" },
      data: { providerStatus: "ACTIVE", stripeCustomerReference: "cus_1", stripeSubscriptionReference: "sub_1" },
    });
    expect(tx.membershipSubscriptionEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ stripeEventId: "evt_checkout" }) });
    expect(tx.membershipGrant.create).not.toHaveBeenCalled();
  });

  it("grants exactly one anchored calendar month from the authoritative paid invoice", async () => {
    const tx = transaction();
    const handled = await processSubscriptionStripeEvent(event("invoice.paid", { subscription: "sub_1" }, "evt_invoice"), tx as never);

    expect(handled).toBe(true);
    expect(tx.membershipGrant.create).toHaveBeenCalledTimes(1);
    expect(tx.membershipGrant.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      amountCents: 999,
      anchorDay: 31,
      effectiveEndAt: new Date("2027-02-28T12:00:00.000Z"),
      effectiveStartAt: new Date("2027-01-31T12:00:00.000Z"),
      monthsGranted: 1,
      source: "SUBSCRIPTION",
      sourceReference: "evt_invoice",
      userId: "USER-1",
    }) });
  });

  it("recovers authoritative subscription metadata when invoice delivery precedes checkout delivery", async () => {
    const tx = transaction();
    tx.membershipSubscription.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ canceledAt: null, membershipSubscriptionId: "MEMSUB-1", stripeCustomerReference: null, stripeSubscriptionReference: null, userId: "USER-1" });
    const handled = await processSubscriptionStripeEvent(event("invoice.paid", {
      customer: "cus_1",
      parent: { subscription_details: { metadata: { membershipSubscriptionId: "MEMSUB-1" }, subscription: "sub_1" } },
    }, "evt_invoice_first"), tx as never);

    expect(handled).toBe(true);
    expect(tx.membershipSubscription.update).toHaveBeenCalledWith({
      where: { membershipSubscriptionId: "MEMSUB-1" },
      data: { stripeCustomerReference: "cus_1", stripeSubscriptionReference: "sub_1" },
    });
    expect(tx.membershipGrant.create).toHaveBeenCalledTimes(1);
  });

  it("records provider cancellation without revoking already-earned Member time", async () => {
    const tx = transaction();
    const handled = await processSubscriptionStripeEvent(event("customer.subscription.deleted", {
      cancel_at_period_end: true,
      id: "sub_1",
      status: "canceled",
    }, "evt_deleted"), tx as never);

    expect(handled).toBe(true);
    expect(tx.membershipSubscription.update).toHaveBeenCalledWith({
      where: { membershipSubscriptionId: "MEMSUB-1" },
      data: { canceledAt: new Date("2027-01-31T12:00:00.000Z"), cancelAtPeriodEnd: true, providerStatus: "CANCELED" },
    });
    expect(tx.membershipGrant.create).not.toHaveBeenCalled();
  });
});
