import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CityBuilderAdminPage } from "../../src/screens/admin/CityBuilderAdminPage";

const entry = (screenId: string, path: string) => ({ originalPage: 0, page: 0, path, reviewOrder: 0, screenId, source: "TEST", title: "City Builder" });
const settlementWorld = { settlement: { classification: "CITY", name: "Anchor", settlementId: "SET-1", site: { regionId: "R01", siteId: "SITE-1" } }, settlementWorldId: "SW-1", worldKey: "CONCORD" };
const city = { buildings: [], cityId: "CITY-1", geometryVersion: 3, name: "Anchor", parcels: [{ geometry: { ring: [] }, parcelId: "PARCEL-1" }], settlementWorld, streets: [] };

function renderCity(screenId: string, path: string, pathname = path) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CityBuilderAdminPage pathname={pathname} screen={entry(screenId, path)} /></QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe("City Builder administration", () => {
  it("lists canonical projects and eligible SettlementWorld records", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ availableSettlementWorlds: [settlementWorld], cities: [city] }), ok: true }));
    renderCity("CITY01", "/admin/cities");
    expect(await screen.findAllByText("Anchor")).toHaveLength(2);
    expect(screen.getByText("1 parcels · 0 streets · 0 buildings")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/admin/cities/CITY-1/streets");
    expect(screen.getByRole("button", { name: "Create geometry project" })).toBeEnabled();
  });

  it("shows persisted Parcel and Street geometry and sends an owned versioned mutation", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_request: RequestInfo | URL, init?: RequestInit) => init?.method === "PUT"
      ? { json: async () => ({ city }), ok: true }
      : { json: async () => ({ city }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderCity("CITY02", "/admin/cities/:id/streets", "/admin/cities/CITY-1/streets");
    expect(await screen.findByText("PARCEL-1")).toBeInTheDocument();
    const parcelIdInputs = screen.getAllByLabelText("Parcel ID");
    fireEvent.change(parcelIdInputs[0]!, { target: { value: "PARCEL-2" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save geometry" })[0]!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/cities/CITY-1", expect.objectContaining({ method: "PUT" })));
    const put = fetchMock.mock.calls.find((call) => call[1]?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ action: "upsertParcel", geometry: {}, parcelId: "PARCEL-2" });
  });

  it("keeps the Interior screen fail-closed when no canonical interior owner exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ city }), ok: true }));
    renderCity("CITY04", "/admin/cities/:id/interiors", "/admin/cities/CITY-1/interiors");
    expect(await screen.findByText(/No canonical Interior, Room, Passage/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save interior/ })).not.toBeInTheDocument();
  });
});
