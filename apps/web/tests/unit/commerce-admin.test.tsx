import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { CommerceAdminPage } from "../../src/screens/admin/CommerceAdminPage";

function renderCommerce(screenId: string) {
  const entry = pageManifest.find((candidate) => candidate.screenId === screenId)!;
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CommerceAdminPage screen={entry} /></QueryClientProvider>);
}

function renderUnknownCommerce() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CommerceAdminPage screen={{ originalPage: 0, page: 0, path: "/admin/store/unknown", reviewOrder: 0, screenId: "UNKNOWN", source: "TEST", title: "Unknown" }} /></QueryClientProvider>);
}

describe("commerce administration projection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders only persisted product configuration without filling unresolved values", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        orders: [],
        products: [{ active: false, artworkAssetId: null, name: "Owner supplied product", storeProductId: "PRODUCT-1", variants: [] }],
      }),
      ok: true,
    }));
    renderCommerce("ADM012");
    expect(await screen.findByText("Owner supplied product")).toBeInTheDocument();
    expect(screen.getByText("Unconfigured")).toBeInTheDocument();
    expect(screen.queryByText(/\$24|\$32|\$64|11 oz|24 × 36/)).not.toBeInTheDocument();
  });

  it("shows payment and fulfillment only from their separate persisted confirmations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        products: [],
        orders: [{
          createdAt: "2026-08-10T00:00:00.000Z",
          lines: [],
          orderId: "ORDER-1",
          paymentConfirmation: { amountCents: 5000, confirmedAt: "2026-08-10T00:01:00.000Z", fulfillment: null },
          refundedAmountCents: 0,
          returnEligibility: null,
          user: { email: "buyer@example.test", id: "USER-1" },
        }],
      }),
      ok: true,
    }));
    renderCommerce("ADM014");
    expect(await screen.findByText("ORDER-1")).toBeInTheDocument();
    expect(screen.getByText("Stripe confirmed")).toBeInTheDocument();
    expect(screen.getByText("Not submitted")).toBeInTheDocument();
    expect(screen.getByText("Not eligible")).toBeInTheDocument();
  });

  it.each([
    ["ADM011", "Store category workflow unavailable"],
    ["ADM013", "Store item editor unavailable"],
    ["ADM016", "Subscription order workflow unavailable"],
    ["ADM017", "Donation order workflow unavailable"],
    ["ADM018", "Order detail workflow unavailable"],
  ])("does not substitute another workflow for %s", (screenId, heading) => {
    vi.stubGlobal("fetch", vi.fn());
    renderCommerce(screenId);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed for an unknown commerce screen", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderUnknownCommerce();
    expect(screen.getByRole("heading", { name: "Commerce workflow unavailable" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
