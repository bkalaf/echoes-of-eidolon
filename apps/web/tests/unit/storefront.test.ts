import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { getStoreCheckoutStatus } from "../../src/server/storefront";

describe("Store checkout status", () => {
  it("projects only an order owned by the authenticated user and its persisted confirmation", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      createdAt: new Date("2026-08-11T00:00:00.000Z"),
      lines: [{ orderLineId: "LINE-1", quantity: 2, storeVariant: { color: "Blue", size: null, storeProduct: { name: "Mug" } }, unitPriceCents: 2500 }],
      orderId: "ORDER-1",
      paymentConfirmation: { amountCents: 5000, confirmedAt: new Date("2026-08-11T00:01:00.000Z"), fulfillment: null },
    });
    const database = { order: { findFirst } } as unknown as PrismaClient;
    const result = await getStoreCheckoutStatus({ checkoutReference: "cs_owner", userId: "USER-1" }, database);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { stripeCheckoutReference: "cs_owner", userId: "USER-1" } }));
    expect(result).toEqual(expect.objectContaining({ orderId: "ORDER-1", payment: expect.objectContaining({ amountCents: 5000 }) }));
  });

  it("returns null instead of disclosing another account's checkout", async () => {
    const database = { order: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;
    await expect(getStoreCheckoutStatus({ checkoutReference: "cs_unknown", userId: "USER-1" }, database)).resolves.toBeNull();
  });
});
