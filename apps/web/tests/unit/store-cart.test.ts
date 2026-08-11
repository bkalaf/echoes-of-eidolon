import { describe, expect, it } from "vitest";

import { addStoreCartLine, normalizeStoreCart, updateStoreCartLine } from "../../src/domain/store-cart";

describe("Store cart state", () => {
  it("keeps only bounded variant identifiers and quantities", () => {
    expect(normalizeStoreCart([
      { storeVariantId: "VARIANT-1", quantity: 2 },
      { storeVariantId: "VARIANT-1", quantity: 3 },
      { storeVariantId: "", quantity: 1 },
      { storeVariantId: "VARIANT-2", quantity: 21 },
      { storeVariantId: "VARIANT-3", quantity: "1" },
    ])).toEqual([{ storeVariantId: "VARIANT-1", quantity: 5 }]);
  });

  it("adds, updates, and removes lines without accepting a browser price", () => {
    const added = addStoreCartLine([], "VARIANT-1", 2);
    expect(added).toEqual([{ storeVariantId: "VARIANT-1", quantity: 2 }]);
    expect(updateStoreCartLine(added, "VARIANT-1", 4)).toEqual([{ storeVariantId: "VARIANT-1", quantity: 4 }]);
    expect(updateStoreCartLine(added, "VARIANT-1", 0)).toEqual([]);
    expect(added[0]).not.toHaveProperty("priceCents");
  });
});
