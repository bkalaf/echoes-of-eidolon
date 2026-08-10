import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { readCart, writeCart } from "../../src/domain/store";
import { pageManifest } from "../../src/lib/page-manifest";
import { StorePage } from "../../src/screens/store/StorePage";

function storeScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

describe("store interaction boundaries", () => {
  beforeEach(() => window.localStorage.clear());

  it("adds the reviewed product and quantity to the local cart", () => {
    render(<StorePage screen={storeScreen("STORE05")} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantity" }), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(readCart(window.localStorage)).toEqual([
      { sku: "conjunction-1-mug", quantity: 2 },
    ]);
    expect(screen.getByText(/2 added to cart/)).toBeInTheDocument();
  });

  it("renders cart totals from stored lines instead of preloaded examples", () => {
    writeCart(window.localStorage, [{ sku: "conjunction-17-poster", quantity: 2 }]);
    render(<StorePage screen={storeScreen("STORE06")} />);

    expect(screen.getByRole("heading", { name: "Conjunction 17 — Poster" })).toBeInTheDocument();
    expect(screen.getAllByText("$64.00").length).toBeGreaterThan(0);
    expect(screen.queryByText("Conjunction 1 — Mug")).not.toBeInTheDocument();
  });

  it("does not fabricate a confirmed order from the result route", () => {
    render(<StorePage screen={storeScreen("STORE10")} />);

    expect(screen.getByRole("heading", { name: "Order Confirmed" })).toBeInTheDocument();
    expect(screen.getByText(/No verified Stripe checkout result/)).toBeInTheDocument();
    expect(screen.queryByText(/EID-10482/)).not.toBeInTheDocument();
  });

  it("blocks payment until the fulfillment and order contracts exist", () => {
    writeCart(window.localStorage, [{ sku: "conjunction-1-mug", quantity: 1 }]);
    render(<StorePage screen={storeScreen("STORE07")} />);

    expect(screen.getByRole("button", { name: "Continue to Stripe unavailable" })).toBeDisabled();
    expect(screen.getByText(/Printful product\/variant identifiers/)).toBeInTheDocument();
  });
});
