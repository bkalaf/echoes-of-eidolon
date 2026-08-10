import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../src/lib/auth-client", () => ({ authClient: { useSession: authMocks.useSession } }));

import { pageManifest } from "../../src/lib/page-manifest";
import { AdminPage } from "../../src/screens/admin/AdminPage";

const catalog = {
  releaseId: "R08-TEST",
  worldId: "EIDOLON",
  coordinateReferenceSystem: "EPSG:4326",
  pointsOfInterest: [
    { poiId: "POI-0001", workingLabel: "Harbor", displayName: null, nameStatus: "WORKING", category: "HARBOR", latitude: 0, longitude: 0, regionId: "REG-01" },
    { poiId: "POI-0007", workingLabel: "World Tree", displayName: "World Tree", nameStatus: "CANONICAL", category: "WORLD_TREE", latitude: 10, longitude: 20, regionId: "REG-02" },
  ],
  settlementSites: [],
};

function renderAtlas(screenId: string) {
  const entry = pageManifest.find((candidate) => candidate.screenId === screenId)!;
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AdminPage pathname="/admin/atlas/pois" screen={entry} /></QueryClientProvider>);
}

describe("authorized R08 Atlas administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.useSession.mockReturnValue({ data: { user: { id: "admin-1", role: "admin" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => catalog, ok: true }));
  });

  it("loads canonical coordinate-derived POIs and synchronizes selection", async () => {
    renderAtlas("ATLAS_POI_2D");
    expect(await screen.findByText("2 canonical Points of Interest · EPSG:4326 · R08-TEST")).toBeInTheDocument();
    expect(screen.getByText("Select a Point of Interest from the map or table.")).toBeInTheDocument();
    expect(screen.queryByText("POI-0001 · Harbor")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select World Tree" }));
    expect(screen.getByText("POI-0007 · World Tree")).toBeInTheDocument();
    expect(screen.getAllByText("WORLD_TREE")).toHaveLength(2);
  });

  it("provides keyboard-operable textured globe controls", async () => {
    renderAtlas("ATLAS_POI_3D");
    const globe = await screen.findByRole("application", { name: /Interactive Eidolon globe/ });
    expect(globe.querySelector("img")).toHaveAttribute("src", expect.stringMatching(/digitaloceanspaces\.com\/assets\/[a-f0-9]{64}\.png$/));
    fireEvent.keyDown(globe, { key: "ArrowRight" });
    expect(screen.getByText(/Center 0°, 10°/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset globe" }));
    expect(screen.getByText(/Center 0°, 0°/)).toBeInTheDocument();
  });
});
