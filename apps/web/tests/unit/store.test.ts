import { describe, expect, it } from "vitest";

import { merchandiseConfigurationRequired, storeProductTypes } from "../../src/domain/store";

describe("store catalog boundary", () => {
  it("contains exactly the three approved product types without fabricated configuration", () => {
    expect(storeProductTypes.map((product) => product.productType)).toEqual(["HOODIE", "MUG", "POSTER"]);
    for (const product of storeProductTypes) {
      expect(product).not.toHaveProperty("priceCents");
      expect(product).not.toHaveProperty("conjunction");
      expect(product).not.toHaveProperty("variant");
      expect(product).not.toHaveProperty("printfulId");
      expect(product).not.toHaveProperty("stripeId");
    }
    expect(merchandiseConfigurationRequired).toContain("Conjunction artwork mapping");
  });
});
