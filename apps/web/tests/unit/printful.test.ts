import { describe, expect, it, vi } from "vitest";

import { createPrintfulOrder, printfulRecipientFromStripe } from "../../src/server/printful";

describe("Printful fulfillment adapter", () => {
  it("maps only configured external variant references and uses an idempotent external order ID", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ code: 200, result: { id: 12345 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    await expect(createPrintfulOrder({
      orderId: "ORDER-1",
      recipient: { name: "A Person", address1: "1 Main St", city: "Town", stateCode: "CA", countryCode: "US", zip: "90001" },
      lines: [{ orderLineId: "LINE-1", printfulVariantReference: "configured-external-variant", quantity: 2, unitPriceCents: 4321 }],
    }, { apiToken: "test-token", storeId: "store-1", fetcher })).resolves.toBe("12345");

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.printful.com/orders?confirm=true&update_existing=true",
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).toEqual(expect.objectContaining({ "X-PF-Store-Id": "store-1" }));
    expect(JSON.parse(String(request.body))).toEqual(expect.objectContaining({
      external_id: "ORDER-1",
      items: [{ external_id: "LINE-1", external_variant_id: "configured-external-variant", quantity: 2, retail_price: "43.21" }],
    }));
  });

  it("rejects absent mappings and incomplete Stripe shipping details before calling Printful", async () => {
    const fetcher = vi.fn();
    await expect(createPrintfulOrder({
      orderId: "ORDER-1",
      recipient: { name: "A Person", address1: "1 Main St", city: "Town", countryCode: "US", zip: "90001" },
      lines: [{ orderLineId: "LINE-1", printfulVariantReference: "", quantity: 1, unitPriceCents: 1000 }],
    }, { apiToken: "test-token", fetcher })).rejects.toThrow(/configured StoreVariant references/);
    expect(fetcher).not.toHaveBeenCalled();
    expect(() => printfulRecipientFromStripe({ collected_information: null, customer_details: null } as never)).toThrow();
  });
});
