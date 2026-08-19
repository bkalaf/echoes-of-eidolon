import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../src/lib/auth-client", () => ({ authClient: { useSession: authMocks.useSession } }));

import { pageManifest } from "../../src/lib/page-manifest";
import { AdminPage } from "../../src/screens/admin/AdminPage";

const catalog = {
  releaseId: "R09-TEST",
  worldId: "EIDOLON",
  coordinateReferenceSystem: "EPSG:4326",
  pointsOfInterest: [
    { poiId: "POI-0001", workingLabel: "Harbor", displayName: null, nameStatus: "WORKING", category: "HARBOR", latitude: 0, longitude: 0, regionId: "R01", latticeId: "L03" },
    { poiId: "POI-0007", workingLabel: "World Tree", displayName: "World Tree", nameStatus: "CANONICAL", category: "WORLD_TREE", latitude: 10, longitude: 20, regionId: "R02", latticeId: "L01" },
  ],
  regionMappings: [],
  connections: [],
  settlementSites: [],
};

function renderAtlas(screenId: string, pathname = "/admin/atlas/pois") {
  const entry = pageManifest.find((candidate) => candidate.screenId === screenId)!;
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AdminPage pathname={pathname} screen={entry} /></QueryClientProvider>);
}

describe("authorized R09 Atlas administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    authMocks.useSession.mockReturnValue({ data: { user: { id: "admin-1", role: "admin" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => catalog, ok: true }));
  });

  it("loads canonical coordinate-derived POIs and synchronizes selection", async () => {
    renderAtlas("ATLAS_POI_2D");
    expect(await screen.findByText("2 canonical Points of Interest · EPSG:4326 · R09-TEST")).toBeInTheDocument();
    expect(screen.getByText("Select a Point of Interest from the map or table.")).toBeInTheDocument();
    expect(screen.queryByText("POI-0001 · Harbor")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select World Tree" }));
    expect(screen.getByText("POI-0007 · World Tree")).toBeInTheDocument();
    expect(screen.getByText("WORLD_TREE", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "WORLD_TREE" })).toBeInTheDocument();
    expect(screen.getByText("L01", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "L01" })).toBeInTheDocument();
  });

  it("provides keyboard-operable textured globe controls", async () => {
    renderAtlas("ATLAS_POI_3D");
    const globe = await screen.findByRole("application", { name: /Interactive Eidolon globe/ });
    expect(globe.querySelector("canvas")).toBeInTheDocument();
    fireEvent.keyDown(globe, { key: "ArrowRight" });
    expect(screen.getByText(/Rotation -7°, -19°/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset globe" }));
    expect(screen.getByText(/Rotation -7°, -26°/)).toBeInTheDocument();
  });

  it("composes Site classification/Region filters with selected-world Settlement occupancy", async () => {
    const siteCatalog = { ...catalog, settlementSites: [
      { siteId: "SITE-0243", regionId: "R10", latticeId: "L10", classification: "HAMLET", latitude: 1, longitude: 2 },
      { siteId: "SITE-0401", regionId: "R06", latticeId: "L06", classification: "CITY", latitude: 20.360822, longitude: -32.076454 },
      { siteId: "SITE-0100", regionId: "R01", latticeId: "L01", classification: "TOWN", latitude: 5, longitude: 6 },
    ] };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input).includes("/api/admin/settlements")
      ? { json: async () => ({ settlements: String(input).includes("world=CONCORD") ? [{ settlement: { classification: "CITY", name: "Ascendancy", settlementId: "SET_ASCENDANCY", site: { latitude: 20.360822, longitude: -32.076454, regionId: "R06", siteId: "SITE-0401" } }, settlementWorldId: "SW_ASCENDANCY_CONCORD", totalPopulation: 100, worldKey: "CONCORD" }] : [] }), ok: true }
      : { json: async () => siteCatalog, ok: true }));
    renderAtlas("AT004", "/admin/atlas/sites");
    await screen.findByRole("heading", { name: "Atlas Site workspace" });
    fireEvent.change(screen.getByLabelText("Current World context"), { target: { value: "CONCORD" } });
    expect(await screen.findByText(/1 founded in CONCORD/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Candidate classification"), { target: { value: "CITY" } });
    fireEvent.change(screen.getByLabelText("Region"), { target: { value: "R06" } });
    expect(screen.getByText("1 of 3 Sites")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search Site ID"), { target: { value: "0401" } });
    const searchResults = await screen.findByLabelText("Site search results");
    fireEvent.click(within(searchResults).getByRole("button", { name: /SITE-0401/ }));
    expect(screen.getByText("Ascendancy", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("Already founded")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Already founded")).not.toHaveAttribute("href");
    expect(screen.getByRole("combobox", { name: /Base morphology/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Current World context"), { target: { value: "RUIN" } });
    expect(await screen.findByText(/0 founded in RUIN/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByLabelText("Site search results")).getByRole("button", { name: /SITE-0401/ }));
    expect(screen.getByText("Found City")).toHaveAttribute("href", "/admin/atlas/sites/SITE-0401");
  });

  it("filters every approved candidate classification independently", async () => {
    const settlementSites = ["HAMLET", "VILLAGE", "TOWN", "CITY", "METROPOLIS"].map((classification, index) => ({
      classification,
      latticeId: `L0${index + 1}`,
      latitude: index,
      longitude: index,
      regionId: `R0${index + 1}`,
      siteId: `SITE-000${index + 1}`,
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ ...catalog, settlementSites }), ok: true }));
    renderAtlas("AT004", "/admin/atlas/sites");
    await screen.findByText("5 of 5 Sites");
    for (const classification of ["HAMLET", "VILLAGE", "TOWN", "CITY", "METROPOLIS"]) {
      fireEvent.change(screen.getByLabelText("Candidate classification"), { target: { value: classification } });
      expect(screen.getByText("1 of 5 Sites")).toBeInTheDocument();
      expect(screen.getByRole("cell", { name: classification })).toBeInTheDocument();
    }
  });
});
