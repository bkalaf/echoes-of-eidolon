import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AtlasAdminPage } from "../../src/screens/admin/AtlasAdminPage";

const foundCityScreen = { originalPage: 0, page: 0, path: "/admin/atlas/sites/SITE-0081", reviewOrder: 0, screenId: "AT004_FOUND_CITY", source: "TEST", title: "Found City" };

describe("Found City reviewed UI contract", () => {
  beforeEach(() => {
    window.sessionStorage.setItem("echoes.admin.atlas.current-world", "CONCORD");
  });

  it("inherits current World, uses Breed rows, and completes the explicit copy/validate/apply handoff", async () => {
    const fetchMock = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      if (url === "/api/atlas/catalog") return { ok: true, json: async () => ({ connections: [], coordinateReferenceSystem: "test", pointsOfInterest: [], regionMappings: [], releaseId: "R09", settlementSites: [] }) };
      if (url.startsWith("/api/admin/settlements/?world=")) return { ok: true, json: async () => ({ settlements: [{ latestYear: 5, populations: [{ breedId: "BREED-A", population: 10 }], settlement: { name: "Origin", settlementId: "SET-ORIGIN" }, settlementWorldId: "SW-ORIGIN" }] }) };
      if (url === "/api/admin/settlements/found-city") return { ok: true, json: async () => ({ promptText: "EXACT PERSISTED PROMPT", promptVersionId: "PV-1", settlementId: "SET-NEW", totalArriving: 9, totalDeparting: 10 }) };
      if (url === "/api/admin/settlements/complete-naming") return { ok: true, json: async () => ({ promptTextResultId: "RESULT-1" }) };
      if (url === "/api/admin/settlements/apply-naming") return { ok: true, json: async () => ({ settlementId: "SET-NEW" }) };
      throw new Error(`Unexpected request ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AtlasAdminPage pathname="/admin/atlas/sites/SITE-0081" screen={foundCityScreen} /></QueryClientProvider>);

    expect(await screen.findByRole("heading", { name: "Found a city in CONCORD" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Current World context")).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Origin"), { target: { value: "SW-ORIGIN" } });
    fireEvent.change(screen.getByLabelText("Breed"), { target: { value: "BREED-A" } });
    fireEvent.change(screen.getByLabelText("Full departure population"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Breed departure" }));
    expect(screen.getByText(/10 full departures · 9 destination arrivals · 1 founding transit loss/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Commit Founding" }));
    expect(await screen.findByText("Naming prompt ready. Click this button to copy it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Naming Prompt" })).toBeEnabled();
    expect(screen.getByText("EXACT PERSISTED PROMPT")).toBeInTheDocument();

    const response = JSON.stringify({ settlement: { settlementId: "SET-NEW", name: "New City" }, features: [] });
    fireEvent.change(screen.getByLabelText("Naming response JSON"), { target: { value: response } });
    fireEvent.click(screen.getByRole("button", { name: "Validate Response" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/settlements/complete-naming", expect.objectContaining({ body: JSON.stringify({ promptVersionId: "PV-1", rawResponse: response }) })));
    expect(await screen.findByRole("button", { name: "Apply Names" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply Names" }));
    expect(await screen.findByText("Names applied atomically to SET-NEW.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([request]) => String(request)).some((url) => /openai|chatgpt|llm/i.test(url))).toBe(false);
  });
});
