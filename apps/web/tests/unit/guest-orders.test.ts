import { beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { assertGuestLookupRateLimit, getPublicOrder, issueOrderAccessTokenData, requestOrderStatusLink } from "../../src/server/guest-orders";

describe("privacy-safe guest order access", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = "a-secure-development-secret-of-32-chars";
    process.env.BETTER_AUTH_URL = "https://example.test";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM_EMAIL = "noreply@example.test";
  });

  it("issues a private token and exposes only the authorized public order projection", async () => {
    const issued = issueOrderAccessTokenData("ORDER-1", "Guest@Example.Test", new Date("2027-01-01T00:00:00.000Z"));
    const database = { orderPublicAccessToken: { findUnique: async () => ({
      emailHash: issued.data.emailHash,
      expiresAt: new Date("2027-02-01T00:00:00.000Z"),
      order: {
        contactEmail: "guest@example.test",
        createdAt: new Date("2027-01-01T00:00:00.000Z"),
        lines: [{ orderLineId: "LINE-1", quantity: 1, storeVariant: { color: "Blue", size: null, storeProduct: { name: "Mug" } }, unitPriceCents: 2500 }],
        orderId: "ORDER-1",
        paymentConfirmation: { amountCents: 2500, confirmedAt: new Date("2027-01-01T00:01:00.000Z"), fulfillment: null },
        refunds: [],
        shippingSummary: { city: "San Diego", country: "US" },
      },
      revokedAt: null,
    }) } } as unknown as PrismaClient;

    const order = await getPublicOrder(issued.token, database);
    expect(order).toMatchObject({ orderId: "ORDER-1", items: [{ name: "Mug" }], payment: { amountCents: 2500 } });
    expect(order).not.toHaveProperty("contactEmail");
    expect(JSON.stringify(order)).not.toMatch(/stripe|card|guest@example/i);
  });

  it("uses the same accepted response for an invalid email/order combination", async () => {
    const database = { order: { findFirst: async () => null } } as unknown as PrismaClient;
    await expect(requestOrderStatusLink({ email: "nobody@example.test", orderId: "MISSING", rateLimitKey: `missing-${Date.now()}` }, database)).resolves.toEqual({ accepted: true });
  });

  it("rate-limits repeated lookup attempts", () => {
    const key = `bounded-${Date.now()}-${Math.random()}`;
    for (let index = 0; index < 5; index += 1) assertGuestLookupRateLimit(key, index);
    expect(() => assertGuestLookupRateLimit(key, 5)).toThrow();
  });
});
