import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { CommerceAdminPage } from "../../src/screens/admin/CommerceAdminPage";

const emptyProjection = { categories: [], donations: [], orders: [], products: [] };

function renderCommerce(screenId: string, pathname?: string) {
  const entry = pageManifest.find((candidate) => candidate.screenId === screenId)!;
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CommerceAdminPage pathname={pathname ?? entry.path!.split("?")[0]!} screen={entry} /></QueryClientProvider>);
}

function renderUnknownCommerce() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CommerceAdminPage pathname="/admin/store/unknown" screen={{ originalPage: 0, page: 0, path: "/admin/store/unknown", reviewOrder: 0, screenId: "UNKNOWN", source: "TEST", title: "Unknown" }} /></QueryClientProvider>);
}

function mockCommerce(data: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ ...emptyProjection, ...data }), ok: true }));
}

describe("commerce administration projection", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("renders only persisted product configuration without filling unresolved values", async () => {
    mockCommerce({ products: [{ active: false, artworkAssetId: null, name: "Owner supplied product", productType: "MUG", storeProductId: "PRODUCT-1", variants: [] }] });
    renderCommerce("ADM012");
    expect(await screen.findByText("Owner supplied product")).toBeInTheDocument();
    expect(screen.getByText("Unconfigured")).toBeInTheDocument();
    expect(screen.queryByText(/\$24|\$32|\$64|11 oz|24 × 36/)).not.toBeInTheDocument();
  });

  it("creates an unpublished item from explicit administrator input", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? { json: async () => ({ product: { storeProductId: "PRODUCT-1" } }), ok: true }
      : { json: async () => ({ ...emptyProjection, categories: [
        { activeItems: 0, categoryPath: "/store/categories/mugs", items: 0, name: "Mug", productType: "MUG" },
      ] }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderCommerce("ADM012");
    fireEvent.click(await screen.findByRole("button", { name: "New item" }));
    fireEvent.change(screen.getByLabelText("Product identifier"), { target: { value: "PRODUCT-1" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Owner item" } });
    fireEvent.change(screen.getByLabelText("Canonical category"), { target: { value: "MUG" } });
    fireEvent.click(screen.getByRole("button", { name: "Create item" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/commerce/products/", expect.objectContaining({
      body: JSON.stringify({ artworkAssetId: null, name: "Owner item", productType: "MUG", storeProductId: "PRODUCT-1" }),
      method: "POST",
    })));
  });

  it("edits exact product and provider variant configuration", async () => {
    const product = { active: false, artworkAssetId: "ASSET-1", name: "Owner item", productType: "MUG", storeProductId: "PRODUCT-1", variants: [{
      available: false, color: "Blue", priceCents: 2400, printfulConfigured: true, printfulVariantReference: "PF-1", size: "11 oz", storeVariantId: "VARIANT-1", stripeConfigured: true, stripePriceReference: "price_1",
    }] };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method
      ? { json: async () => ({ variant: {} }), ok: true }
      : { json: async () => ({ ...emptyProjection, products: [product] }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderCommerce("ADM013", "/admin/store/items/PRODUCT-1");
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Price in cents"), { target: { value: "2600" } });
    fireEvent.click(screen.getByRole("button", { name: "Save variant" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/commerce/products/PRODUCT-1/variants", expect.objectContaining({
      body: JSON.stringify({ available: false, color: "Blue", priceCents: 2600, printfulVariantReference: "PF-1", size: "11 oz", storeVariantId: "VARIANT-1", stripePriceReference: "price_1" }),
      method: "PUT",
    })));
  });

  it("projects the finite canonical categories instead of inventing taxonomy records", async () => {
    mockCommerce({ categories: [
      { activeItems: 0, categoryPath: "/store/categories/hoodies", items: 0, name: "Hoodie", productType: "HOODIE" },
      { activeItems: 1, categoryPath: "/store/categories/mugs", items: 1, name: "Mug", productType: "MUG" },
      { activeItems: 0, categoryPath: "/store/categories/posters", items: 0, name: "Poster", productType: "POSTER" },
    ] });
    renderCommerce("ADM011");
    expect(await screen.findByText("Canonical Store categories")).toBeInTheDocument();
    expect(screen.getByText("HOODIE")).toBeInTheDocument();
    expect(screen.getByText("MUG")).toBeInTheDocument();
    expect(screen.getByText("POSTER")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new/i })).not.toBeInTheDocument();
  });

  it("shows payment and fulfillment only from their separate persisted confirmations", async () => {
    mockCommerce({ orders: [{
      createdAt: "2026-08-10T00:00:00.000Z",
      lines: [],
      orderId: "ORDER-1",
      paymentConfirmation: { amountCents: 5000, confirmedAt: "2026-08-10T00:01:00.000Z", fulfillment: null },
      refundedAmountCents: 0,
      refunds: [],
      returnEligibility: null,
      user: { email: "buyer@example.test", id: "USER-1" },
    }] });
    renderCommerce("ADM014");
    expect(await screen.findByText("ORDER-1")).toBeInTheDocument();
    expect(screen.getByText("Stripe confirmed")).toBeInTheDocument();
    expect(screen.getByText("Not submitted")).toBeInTheDocument();
  });

  it("renders persisted donation transactions in their own order state", async () => {
    mockCommerce({ donations: [{
      amountCents: 5000,
      confirmedAt: "2026-08-10T00:01:00.000Z",
      createdAt: "2026-08-10T00:00:00.000Z",
      donationCheckoutId: "DONATION-1",
      monthsGranted: 6,
      status: "CONFIRMED",
      stripeConfigured: true,
      user: { email: "donor@example.test", id: "USER-1" },
    }] });
    renderCommerce("ADM017");
    expect(await screen.findByText("DONATION-1")).toBeInTheDocument();
    expect(screen.getByText("donor@example.test")).toBeInTheDocument();
    expect(screen.getByText("CONFIRMED")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Donations" })).toHaveAttribute("aria-current", "page");
  });

  it("resolves a concrete order detail and keeps unowned mutations disabled", async () => {
    mockCommerce({ orders: [{
      createdAt: "2026-08-10T00:00:00.000Z",
      lines: [{ orderLineId: "LINE-1", quantity: 2, storeVariant: { color: "Blue", size: "L", storeProduct: { name: "Configured item" }, storeVariantId: "VARIANT-1" }, unitPriceCents: 2500 }],
      orderId: "ORDER-1",
      paymentConfirmation: { amountCents: 5000, confirmedAt: "2026-08-10T00:01:00.000Z", fulfillment: { submittedAt: "2026-08-10T00:02:00.000Z" } },
      refundedAmountCents: 1000,
      refunds: [{ amountCents: 1000, refundedAt: "2026-08-10T00:03:00.000Z" }],
      returnEligibility: { eligibleAt: "2026-08-10T00:04:00.000Z" },
      user: { email: "buyer@example.test", id: "USER-1" },
    }] });
    renderCommerce("ADM018", "/admin/orders/ORDER-1");
    expect(await screen.findByRole("heading", { name: "Order ORDER-1" })).toBeInTheDocument();
    expect(screen.getByText("Configured item")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Receipt delivery unavailable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refund requires signed Stripe operation" })).toBeDisabled();
  });

  it("does not relabel membership grants as subscription purchases", async () => {
    mockCommerce({});
    renderCommerce("ADM016");
    expect(await screen.findByRole("heading", { name: "Subscription transactions unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/no authoritative subscription checkout/i)).toBeInTheDocument();
  });

  it("fails closed for an unknown commerce screen without loading records", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderUnknownCommerce();
    expect(screen.getByRole("heading", { name: "Commerce workflow unavailable" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
