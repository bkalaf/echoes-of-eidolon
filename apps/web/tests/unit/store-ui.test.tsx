import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { StorePage } from "../../src/screens/store/StorePage";

function storeScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

function renderStore(screenId: string, overrides = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><StorePage screen={{ ...storeScreen(screenId), ...overrides }} /></QueryClientProvider>);
}

describe("store interaction boundaries", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) })));

  it("renders exactly three product types without mapping, price, or variant claims", async () => {
    renderStore("STORE01");
    expect(await screen.findByRole("heading", { name: "Hoodie" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mug" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Poster" })).toBeInTheDocument();
    expect(screen.getAllByText("Not configured for sale")).toHaveLength(3);
    expect(screen.queryByText(/\$24|\$32|\$64|Conjunction 1 — Mug/)).not.toBeInTheDocument();
  });

  it("uses explicit manifest identity rather than inferring a category from its title", async () => {
    renderStore("STORE02", { title: "Store Category" });
    expect(await screen.findByRole("heading", { name: "Poster" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Mug" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hoodie" })).not.toBeInTheDocument();
  });

  it("does not create a cart line for an unconfigured product", async () => {
    renderStore("STORE05");
    expect(await screen.findByText(/No configured product matches/)).toBeInTheDocument();
  });

  it("requires sign-in and blocks guest checkout", () => {
    renderStore("STORE06");
    expect(screen.getByText(/Guest checkout is not allowed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/sign-in?returnTo=%2Fstore%2Fcart");
  });

  it("does not fabricate a confirmed order from the result route", () => {
    renderStore("STORE10");
    expect(screen.getByRole("heading", { name: "Order Confirmation" })).toBeInTheDocument();
    expect(screen.getByText(/No signed Stripe webhook result/)).toBeInTheDocument();
  });

  it("dispatches the registered Store Support screen without inventing a ticket mutation", () => {
    renderStore("STORE13");
    expect(screen.getByRole("heading", { name: "Store Order Support" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Store support owner-deferred" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("blocks payment until a configured variant exists", async () => {
    renderStore("STORE07");
    expect(await screen.findByRole("button", { name: "Continue to secure payment" })).toBeDisabled();
    expect(await screen.findByText(/Printful product and variant identifiers/)).toBeInTheDocument();
  });

  it("fails closed for an unknown store screen", () => {
    renderStore("STORE13", { screenId: "STORE_UNKNOWN" });

    expect(screen.getByRole("heading", { name: "Store screen unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Store support owner-deferred" })).not.toBeInTheDocument();
  });
});
