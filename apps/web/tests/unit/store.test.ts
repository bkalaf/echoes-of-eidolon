import { describe, expect, it } from "vitest";

import {
  addCartLine,
  cartSubtotalCents,
  readCart,
  writeCart,
  type CartStorage,
} from "../../src/domain/store";

function memoryStorage(): CartStorage & { value?: string } {
  return {
    getItem() { return this.value ?? null; },
    setItem(_key, value) { this.value = value; },
  };
}

describe("store cart", () => {
  it("adds and consolidates exact catalog lines", () => {
    const first = addCartLine([], "conjunction-1-mug", 2);
    const second = addCartLine(first, "conjunction-1-mug", 1);
    expect(second).toEqual([{ sku: "conjunction-1-mug", quantity: 3 }]);
    expect(cartSubtotalCents(second)).toBe(7200);
  });

  it("rejects invalid quantities", () => {
    expect(() => addCartLine([], "conjunction-1-mug", 0)).toThrow("1 through 99");
    expect(() => addCartLine([], "conjunction-1-mug", 100)).toThrow("1 through 99");
  });

  it("round-trips valid carts and fails closed for corrupt or unknown lines", () => {
    const storage = memoryStorage();
    writeCart(storage, [{ sku: "conjunction-17-poster", quantity: 1 }]);
    expect(readCart(storage)).toEqual([{ sku: "conjunction-17-poster", quantity: 1 }]);

    storage.value = '[{"sku":"unknown","quantity":1}]';
    expect(readCart(storage)).toEqual([]);
    storage.value = "not-json";
    expect(readCart(storage)).toEqual([]);
  });
});
