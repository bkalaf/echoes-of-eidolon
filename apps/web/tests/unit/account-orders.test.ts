import type { PrismaClient } from "../../src/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";

import { getAccountOrder, listAccountOrders } from "../../src/server/account-orders";

const storedOrder = {
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
  lines: [{
    orderLineId: "LINE-1",
    quantity: 2,
    storeVariant: {
      color: "Black",
      size: "Large",
      storeProduct: { name: "Hoodie" },
      storeVariantId: "VARIANT-1",
    },
    unitPriceCents: 4321,
  }],
  orderId: "ORDER-1",
  paymentConfirmation: {
    amountCents: 8642,
    confirmedAt: new Date("2026-08-10T00:01:00.000Z"),
    fulfillment: { submittedAt: new Date("2026-08-10T00:02:00.000Z") },
  },
  refunds: [],
  returnEligibility: null,
};

describe("authenticated account order projection", () => {
  it("lists only orders belonging to the authenticated user and redacts provider references", async () => {
    const findMany = vi.fn().mockResolvedValue([storedOrder]);
    const database = { order: { findMany } } as unknown as PrismaClient;

    const result = await listAccountOrders("USER-1", database);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "USER-1" } }));
    expect(result[0]).toEqual(expect.objectContaining({ orderId: "ORDER-1", payment: expect.objectContaining({ amountCents: 8642 }) }));
    expect(JSON.stringify(result)).not.toMatch(/stripe|printful|providerOrderReference/i);
  });

  it("fails closed when an order does not belong to the authenticated user", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const database = { order: { findFirst } } as unknown as PrismaClient;

    await expect(getAccountOrder("ORDER-OTHER", "USER-1", database)).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { orderId: "ORDER-OTHER", userId: "USER-1" },
    }));
  });
});
