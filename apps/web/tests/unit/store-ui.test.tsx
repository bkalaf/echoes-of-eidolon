import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { StorePage } from "../../src/screens/store/StorePage";

function storeScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

describe("store interaction boundaries", () => {
  it("renders exactly three product types without mapping, price, or variant claims", () => {
    render(<StorePage screen={storeScreen("STORE01")} />);
    expect(screen.getByRole("heading", { name: "Hoodie" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mug" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Poster" })).toBeInTheDocument();
    expect(screen.getAllByText("Price and variants unavailable")).toHaveLength(3);
    expect(screen.queryByText(/\$24|\$32|\$64|Conjunction 1 — Mug/)).not.toBeInTheDocument();
  });

  it("does not create a cart line for an unconfigured product", () => {
    render(<StorePage screen={storeScreen("STORE05")} />);
    expect(screen.getByRole("button", { name: "Add to cart unavailable" })).toBeDisabled();
    expect(screen.getByText(/No configured product matches/)).toBeInTheDocument();
  });

  it("requires sign-in and blocks guest checkout", () => {
    render(<StorePage screen={storeScreen("STORE06")} />);
    expect(screen.getByText(/Guest checkout is not allowed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/sign-in?returnTo=%2Fstore%2Fcart");
  });

  it("does not fabricate a confirmed order from the result route", () => {
    render(<StorePage screen={storeScreen("STORE10")} />);
    expect(screen.getByRole("heading", { name: "Order Confirmation" })).toBeInTheDocument();
    expect(screen.getByText(/No signed Stripe webhook result/)).toBeInTheDocument();
  });

  it("blocks payment until the fulfillment and order contracts exist", () => {
    render(<StorePage screen={storeScreen("STORE07")} />);
    expect(screen.getByRole("button", { name: "Continue to Stripe unavailable" })).toBeDisabled();
    expect(screen.getByText(/Printful product and variant identifiers/)).toBeInTheDocument();
  });
});
