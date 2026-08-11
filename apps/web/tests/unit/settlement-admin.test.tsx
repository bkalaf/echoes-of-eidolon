import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementAdminPage } from "../../src/screens/admin/SettlementAdminPage";

const settlements = [
  { culture: { cultureId: "CULTURE-1", name: "Origin Culture" }, dominantBreed: { breedId: "BREED-1", name: "Origin Breed" }, latestYear: 10, populations: [{ breedId: "BREED-1", population: 1000 }], settlement: { classification: "CITY", name: "Origin", settlementId: "SET-1", site: { latitude: 1, longitude: 2, regionId: "R01", siteId: "SITE-1" } }, settlementWorldId: "SW-1", totalPopulation: 1000, worldKey: "CONCORD" },
  { culture: null, dominantBreed: null, latestYear: 8, populations: [{ breedId: "BREED-1", population: 250 }], settlement: { classification: "TOWN", name: "Destination", settlementId: "SET-2", site: { latitude: 3, longitude: 4, regionId: "R02", siteId: "SITE-2" } }, settlementWorldId: "SW-2", totalPopulation: 250, worldKey: "CONCORD" },
];

function renderPage(migrate: boolean) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SettlementAdminPage migrate={migrate} /></QueryClientProvider>);
}

describe("Settlement administration", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_request: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
    ? { json: async () => ({ migrated: true }), ok: true }
    : { json: async () => ({ settlements, worldKey: "CONCORD" }), ok: true })));

  it("requires an explicit current world and renders event-verified Settlement records", async () => {
    renderPage(false);
    expect(screen.queryByText("Origin Culture")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Current world" }), { target: { value: "CONCORD" } });
    expect(await screen.findByText("Origin Culture")).toBeInTheDocument();
    expect(screen.getByText("Origin Breed")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Migrate" })[0]).toHaveAttribute("href", "/admin/atlas/settlements/SET-1/migrate");
  });

  it("previews and commits exact same-world Breed conservation", async () => {
    renderPage(true);
    fireEvent.change(screen.getByRole("combobox", { name: "Current world" }), { target: { value: "CONCORD" } });
    const origin = await screen.findByRole("combobox", { name: "From" });
    await vi.waitFor(() => expect(origin).toBeEnabled());
    fireEvent.change(origin, { target: { value: "SET-1" } });
    await vi.waitFor(() => expect(screen.getByRole("combobox", { name: "To" })).toBeEnabled());
    fireEvent.change(screen.getByRole("combobox", { name: "To" }), { target: { value: "SET-2" } });
    await vi.waitFor(() => expect(screen.getByRole("combobox", { name: "Breed" })).toBeEnabled());
    fireEvent.change(screen.getByRole("combobox", { name: "Breed" }), { target: { value: "BREED-1" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Population" }), { target: { value: "100" } });
    expect(screen.getByText(/Total BREED-1 population is conserved/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Commit migration" }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/settlements/migrate", expect.objectContaining({ method: "POST" })));
    const request = vi.mocked(fetch).mock.calls.find((call) => call[1]?.method === "POST")![1]!;
    expect(JSON.parse(String(request.body))).toEqual({ destinationSettlementId: "SET-2", originSettlementId: "SET-1", rows: [{ amount: 100, breedId: "BREED-1" }], worldKey: "CONCORD", year: 10 });
    expect(await screen.findByRole("status")).toHaveTextContent("Migration committed atomically.");
  });
});
