import { describe, expect, it, vi } from "vitest";

import { assertFulfillmentReady, processSignedStripeWebhook, resolveAuthoritativeCheckoutLine } from "../../src/domain/commerce";

describe("commerce trust boundaries", () => {
  it("resolves price and provider references only from configured server data", () => {
    const request = { storeVariantId: "VARIANT", quantity: 2, priceCents: 1 };
    const line = resolveAuthoritativeCheckoutLine(request, [{
      storeVariantId: "VARIANT", priceCents: 4321, available: true,
      stripePriceReference: "stripe-server-value", printfulVariantReference: "printful-server-value",
    }]);
    expect(line.unitPriceCents).toBe(4321);
    expect(line).not.toHaveProperty("priceCents");
    expect(() => resolveAuthoritativeCheckoutLine({ storeVariantId: "MISSING", quantity: 1 }, [])).toThrow(/unavailable/);
  });

  it("does not permit Printful submission without confirmed Stripe payment", () => {
    expect(() => assertFulfillmentReady({})).toThrow(/server-confirmed Stripe payment/);
    expect(assertFulfillmentReady({ orderPaymentConfirmationId: "PAYMENT" })).toBe("PAYMENT");
  });

  it("verifies signatures before opening a transaction and processes each event once", async () => {
    const process = vi.fn(async () => undefined);
    const create = vi.fn(async () => undefined);
    const findUnique = vi.fn(async () => null);
    const transaction = { stripeWebhookEvent: { create, findUnique } };
    const database = { $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) };
    const verify = vi.fn(() => ({ stripeWebhookEventId: "evt", eventType: "confirmed" }));
    await expect(processSignedStripeWebhook({ rawBody: new TextEncoder().encode("body"), signature: null, verify, database, process, processedAt: new Date(0) })).rejects.toThrow(/signature/);
    expect(database.$transaction).not.toHaveBeenCalled();

    await expect(processSignedStripeWebhook({ rawBody: new TextEncoder().encode("body"), signature: "signature", verify, database, process, processedAt: new Date(0) })).resolves.toBe("processed");
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ stripeWebhookEventId: "evt", payloadSha256: expect.stringMatching(/^[a-f0-9]{64}$/) }) });
    expect(process).toHaveBeenCalledOnce();

    findUnique.mockResolvedValueOnce({ stripeWebhookEventId: "evt" });
    await expect(processSignedStripeWebhook({ rawBody: new TextEncoder().encode("body"), signature: "signature", verify, database, process, processedAt: new Date(0) })).resolves.toBe("duplicate");
    expect(process).toHaveBeenCalledOnce();
  });
});
