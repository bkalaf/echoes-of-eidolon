import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { StorePage } from "../../src/screens/store/StorePage";

function storeScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

function renderStore(screenId: string, overrides = {}, pathname?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><StorePage pathname={pathname} screen={{ ...storeScreen(screenId), ...overrides }} /></QueryClientProvider>);
}

describe("store interaction boundaries", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) }));
  });

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

  it("adds only a configured variant identity and quantity to the local cart", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [{ name: "Configured mug", productType: "MUG", storeProductId: "PRODUCT-1", variants: [{ color: "Blue", priceCents: 2500, size: null, storeVariantId: "VARIANT-1" }] }] }) }));
    renderStore("STORE05", {}, "/store/products/PRODUCT-1");
    fireEvent.click(await screen.findByRole("button", { name: "Add to cart" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Configured mug added to cart");
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("echoes.store.cart.v1")!)).toEqual([{ quantity: 1, storeVariantId: "VARIANT-1" }]));
  });

  it("resolves cart price from the server catalog and allows quantity changes", async () => {
    window.localStorage.setItem("echoes.store.cart.v1", JSON.stringify([{ quantity: 2, storeVariantId: "VARIANT-1" }]));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [{ name: "Configured mug", productType: "MUG", storeProductId: "PRODUCT-1", variants: [{ color: "Blue", priceCents: 2500, size: null, storeVariantId: "VARIANT-1" }] }] }) }));
    renderStore("STORE06");
    expect(await screen.findByText("Catalog total: $50.00")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Quantity for Configured mug"), { target: { value: "3" } });
    expect(await screen.findByText("Catalog total: $75.00")).toBeInTheDocument();
  });

  it("requires sign-in and blocks guest checkout", () => {
    renderStore("STORE06");
    expect(screen.getByText(/Guest checkout is not allowed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/sign-in?returnTo=%2Fstore%2Fcart");
  });

  it("does not fabricate a confirmed order from the result route", () => {
    renderStore("STORE10");
    expect(screen.getByRole("heading", { name: "Order Confirmation" })).toBeInTheDocument();
    expect(screen.getByText(/checkout session reference is required/)).toBeInTheDocument();
  });

  it("renders approval only from the owned order's persisted signed confirmation", async () => {
    window.history.replaceState({}, "", "/store/checkout/approved?session_id=cs_owner");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ order: {
      createdAt: "2026-08-11T00:00:00.000Z",
      lines: [{ color: "Blue", name: "Configured mug", orderLineId: "LINE-1", quantity: 2, size: null, unitPriceCents: 2500 }],
      orderId: "ORDER-1",
      payment: { amountCents: 5000, confirmedAt: "2026-08-11T00:01:00.000Z", fulfillmentSubmittedAt: null },
    } }) }));
    renderStore("STORE10");
    expect(await screen.findByText(/Payment confirmed/)).toBeInTheDocument();
    expect(screen.getByText("Confirmed total: $50.00")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/store/checkout/status?sessionId=cs_owner");
  });

  it("does not infer approval while the webhook confirmation is pending", async () => {
    window.history.replaceState({}, "", "/store/checkout/approved?session_id=cs_pending");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ order: { createdAt: "2026-08-11T00:00:00.000Z", lines: [], orderId: "ORDER-2", payment: null } }) }));
    renderStore("STORE10");
    expect(await screen.findByText(/signed payment webhook has not been persisted yet/)).toBeInTheDocument();
    expect(screen.queryByText(/Payment confirmed/)).not.toBeInTheDocument();
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

  it("submits every cart line without browser-authored prices", async () => {
    window.localStorage.setItem("echoes.store.cart.v1", JSON.stringify([{ quantity: 2, storeVariantId: "VARIANT-1" }, { quantity: 1, storeVariantId: "VARIANT-2" }]));
    const products = [{ name: "Configured mug", productType: "MUG", storeProductId: "PRODUCT-1", variants: [{ color: "Blue", priceCents: 2500, size: null, storeVariantId: "VARIANT-1" }, { color: "Red", priceCents: 2600, size: null, storeVariantId: "VARIANT-2" }] }];
    const fetchMock = vi.fn().mockImplementation(async (request: RequestInfo | URL) => String(request).includes("/checkout")
      ? { ok: false, json: async () => ({ error: "Provider unavailable" }) }
      : { ok: true, json: async () => ({ products }) });
    vi.stubGlobal("fetch", fetchMock);
    renderStore("STORE07");
    const checkout = await screen.findByRole("button", { name: "Continue to secure payment" });
    await waitFor(() => expect(checkout).toBeEnabled());
    fireEvent.click(checkout);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/store/checkout", expect.objectContaining({
      body: JSON.stringify({ lines: [{ quantity: 2, storeVariantId: "VARIANT-1" }, { quantity: 1, storeVariantId: "VARIANT-2" }] }),
      method: "POST",
    })));
  });

  it("fails closed for an unknown store screen", () => {
    renderStore("STORE13", { screenId: "STORE_UNKNOWN" });

    expect(screen.getByRole("heading", { name: "Store screen unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Store support owner-deferred" })).not.toBeInTheDocument();
  });
});
