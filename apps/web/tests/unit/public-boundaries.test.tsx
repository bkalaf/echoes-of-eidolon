import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../src/lib/auth-client", () => ({ authClient: { useSession: authMocks.useSession } }));

import { managedAssetUrl } from "../../src/content/managed-assets";
import { atlasRegionColor } from "../../src/content/atlas-region-presentation";
import { contactTopicSchema, contactTopicTokens } from "../../src/domain/contact";
import { pageManifest } from "../../src/lib/page-manifest";
import { PublicPage } from "../../src/screens/public/PublicPage";

function publicScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

function renderWithQuery(screenId: string, pathname?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><PublicPage pathname={pathname} screen={publicScreen(screenId)} /></QueryClientProvider>);
}

beforeEach(() => {
  authMocks.useSession.mockReturnValue({ data: null, isPending: false });
});

afterEach(() => vi.unstubAllGlobals());

describe("public mutation boundaries", () => {
  it("renders and selects exactly 24 original founding cities with truthful detail", async () => {
    const regionIds = Array.from({ length: 25 }, (_, index) => `R${String(index + 1).padStart(2, "0")}`);
    const regions = regionIds.map((regionId) => ({ color: atlasRegionColor(regionId as Parameters<typeof atlasRegionColor>[0]), name: regionId === "R10" ? "Innerwood" : `Region ${regionId}`, regionId }));
    const foundingCities = regionIds.filter((regionId) => regionId !== "R10").map((regionId, index) => ({
      latitude: index,
      longitude: index * 2,
      name: index === 0 ? "Anseris" : index === 1 ? "Lupin-Ghar" : `Founding City ${regionId}`,
      regionColor: index === 1 ? "#000000" : "#FFFFFF",
      regionId,
      siteId: `SITE-${String(index + 1).padStart(4, "0")}`,
    }));
    const continents = [
      { latitude: 41.093565, longitude: -98.497755, name: "Raukaam" },
      { latitude: 30.236775, longitude: 73.727394, name: "Morgenland" },
      { latitude: -44.543435, longitude: -31.900026, name: "Valdmere" },
    ];
    const geographicPoints = Array.from({ length: 92 }, (_, index) => ({
      category: index === 90 ? "OCEAN" : "PEAK",
      latitude: index % 80 - 40,
      longitude: index % 85 * 4 - 170,
      name: index === 90 ? "Northern Ocean" : `Geographic Feature ${index + 1}`,
      poiId: `POI-${String(index + 1).padStart(3, "0")}`,
      regionId: regionIds[index % regionIds.length],
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ connections: [], continents, foundingCities, geographicPoints, regionMappings: [], regions }),
      ok: true,
    }));
    const { container } = renderWithQuery("PUB_GAME02_WORLD_ATLAS");

    expect(await screen.findByText("24 original founding cities")).toBeInTheDocument();
    expect(container.querySelector(".site-shell--immersive")).toBeInTheDocument();
    expect(container.querySelector(".public-header")).not.toBeInTheDocument();
    expect(container.querySelector(".public-footer")).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "Select Anseris" });
    expect(container.querySelectorAll("[data-atlas-founding-city]")).toHaveLength(24);
    expect(container.querySelector('[data-region-id="R10"]')).toBeNull();
    expect(screen.getByRole("heading", { name: "Select a founding city" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Region colors" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Continent names" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Geographic names" })).toBeChecked();
    expect(container.querySelectorAll("[data-atlas-continent-label]")).toHaveLength(3);
    expect(container.querySelectorAll("[data-atlas-geographic-point]")).toHaveLength(92);
    expect(container.querySelector(".public-atlas-side--layers .atlas-globe-controls")).toBeInTheDocument();
    expect(screen.getByRole("application", { name: /Interactive Eidolon globe/ })).toHaveAttribute("data-zoom-behavior", "diameter");

    fireEvent.click(screen.getByRole("checkbox", { name: "Region colors" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Continent names" }));
    expect(screen.getByRole("application", { name: /Interactive Eidolon globe/ })).toHaveAttribute("data-region-colors", "hidden");
    expect(container.querySelector('[data-atlas-continent-label][data-layer-visible="false"]')).toBeInTheDocument();

    const anseris = screen.getByRole("button", { name: "Select Anseris" });
    fireEvent.click(anseris);
    expect(anseris).toHaveClass("selected");
    expect(screen.getByRole("heading", { name: "Anseris" })).toBeInTheDocument();
    expect(screen.getByText("Original Founding City")).toBeInTheDocument();
    expect(screen.getByText("R01 · Region R01")).toBeInTheDocument();
    expect(screen.getByText("0, 0")).toBeInTheDocument();

    const lupinGhar = screen.getByRole("button", { name: "Select Lupin-Ghar" });
    fireEvent.click(lupinGhar);
    expect(lupinGhar).toHaveClass("selected");
    expect(screen.getByRole("heading", { name: "Lupin-Ghar" })).toBeInTheDocument();
    expect(screen.getByText("R02 · Region R02")).toBeInTheDocument();
    expect(screen.getByText("1, 2")).toBeInTheDocument();
  });

  it("makes the desktop Atlas a centered no-scroll viewport centerpiece", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    expect(styles).toContain(".public-page--atlas");
    expect(styles).toMatch(/\.public-page--atlas\s*\{[^}]*overflow:\s*hidden/s);
    expect(styles).toContain(".public-atlas-stage");
    expect(styles).toMatch(/\.public-atlas-stage\s*\{[^}]*grid-template-columns:[^;}]*1fr[^;}]*1fr/s);
    expect(styles).not.toContain("@media (max-width: 1100px), (max-height: 720px)");
    expect(styles).toMatch(/\.public-atlas-stage[^}]*\.atlas-globe\s*\{[^}]*border:\s*0/s);
  });

  it("uses the captioned Power of Three video in the responsive features panel", () => {
    const { container } = renderWithQuery("PUB002");

    expect(container.querySelector(".video-panel--features > video")).toHaveAttribute("src", managedAssetUrl("video.power-of-three"));
    expect(container.querySelectorAll(".feature-tile .region-crest")).toHaveLength(9);
    expect(container.querySelectorAll(".feature-tile img")).toHaveLength(0);
    expect(container.querySelector(".video-caption")).toHaveTextContent("What makes Echoes of Eidolon different?");
  });

  it("keeps the features video compact only on portrait displays", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

    expect(styles).toContain("@media (max-width: 900px) and (orientation: portrait)");
    expect(styles).toContain(".video-panel--features { min-height: 0; aspect-ratio: 16 / 9; }");
  });

  it("preserves the approved gameplay loop and feature explanation copy", () => {
    const gameplay = render(<PublicPage screen={publicScreen("PUB003")} />);
    expect(screen.getByText("Your Knowledge Base grows as you discover people, places, books, history and connections.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Accept a challenge when you are ready" })).toBeInTheDocument();
    expect(screen.queryByText("Choose what matters")).not.toBeInTheDocument();
    gameplay.unmount();

    render(<PublicPage screen={publicScreen("FEATURE_01")} />);
    expect(screen.getByText("Feature video and screenshots explain the idea without revealing late-story structure.")).toBeInTheDocument();
    expect(screen.queryByText(/content-addressed managed storage/)).not.toBeInTheDocument();
  });

  it("selects feature content by explicit screen identity rather than mutable title", () => {
    const { container } = render(<PublicPage screen={{ ...publicScreen("FEATURE_01"), title: "Changed review title" }} />);

    expect(screen.getByRole("heading", { name: "A Living World", level: 1 })).toBeInTheDocument();
    expect(container.querySelector(".feature-scene__icon.region-crest")).toHaveAttribute("data-crest-asset", "R03.svg");
    expect(container.querySelector(".feature-scene__icon.region-crest")).toHaveAttribute("data-crest-color", "blue");
  });

  it("does not turn an unknown feature screen into the first feature", () => {
    render(<PublicPage screen={{ ...publicScreen("FEATURE_01"), screenId: "FEATURE_UNKNOWN" }} />);

    expect(screen.getByRole("heading", { name: "Feature unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A Living World", level: 1 })).not.toBeInTheDocument();
  });

  it("keeps all eight approved contact topics and enables validated persisted delivery", () => {
    render(<PublicPage screen={publicScreen("PUB015")} />);
    expect(screen.getAllByRole("button").filter((button) => button.classList.contains("topic"))).toHaveLength(8);
    expect(contactTopicTokens).toEqual([...contactTopicTokens].sort());
    expect(screen.getByRole("button", { name: "Clear General company inquiry" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Clear General company inquiry" })).toHaveClass("selected");
    fireEvent.click(screen.getByRole("button", { name: "Select Press and media" }));
    expect(screen.getByRole("button", { name: "Clear Press and media" })).toHaveClass("topic--tone-5");
    expect(document.querySelector<HTMLInputElement>('input[name="topic"]')).toHaveValue("PRESS");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(screen.getByText(/Player support messages should be sent from the Support tab/)).toBeInTheDocument();
  });

  it("rejects every fabricated company contact topic", () => {
    expect(contactTopicSchema.safeParse("SUPPORT").success).toBe(false);
    expect(contactTopicSchema.safeParse("GENERAL").success).toBe(true);
  });

  it("uses the exact invitation consent and requires a session before submission", () => {
    render(<PublicPage screen={publicScreen("PUB023")} />);
    expect(screen.getByText("I agree to be contacted by email.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit request" })).toBeDisabled();
  });

  it("does not turn the donation example into a default selection", () => {
    render(<PublicPage screen={publicScreen("PUB009")} />);
    expect(screen.getByLabelText("Amount in US dollars")).toHaveValue(null);
    expect(screen.getByText("Not selected")).toBeInTheDocument();
    expect(screen.queryByText("$50.00")).not.toBeInTheDocument();
    expect(screen.queryByText("+6 months")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to secure payment" })).toBeDisabled();
  });

  it("shows the exact donation membership grant for the selected amount", () => {
    render(<PublicPage screen={publicScreen("PUB009")} />);

    fireEvent.change(screen.getByLabelText("Amount in US dollars"), { target: { value: "50" } });

    expect(screen.getByText("$50.00")).toBeInTheDocument();
    expect(screen.getByText("+6 months")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to secure payment" })).toBeEnabled();
  });

  it("does not turn the reviewed eligible donation state into a live eligibility result", () => {
    render(<PublicPage screen={publicScreen("PUB021")} />);
    expect(screen.queryByRole("heading", { name: "Eligible participant" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue to donation checkout" })).not.toBeInTheDocument();
  });

  it("does not fabricate version history when no published release exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ currentVersion: "0.2.0", releases: [] }) }));
    renderWithQuery("PUB017");
    expect(await screen.findByText("No player-visible release has been published.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Release archive" })).toBeInTheDocument();
    expect(screen.queryByText(/v0\.2\.0|v0\.1\.9|v0\.1\.8/)).not.toBeInTheDocument();
  });

  it("RN-023 shows the latest authoritative published release on the public status page", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/health") return { ok: true, json: async () => ({ checkedAt: "2026-08-11T00:00:00Z", services: [] }) } as Response;
      if (url === "/api/releases") return { ok: true, json: async () => ({ currentVersion: "0.2.1", releases: [
        { version: "0.2.1", status: "PUBLISHED", title: "Current published release", summary: "Published player release", releaseDate: "2026-08-12", previousVersion: "0.2.0", items: [] },
      ] }) } as Response;
      throw new Error(`Unexpected request: ${url}`);
    }));

    renderWithQuery("PUB016");

    expect(screen.getByText("Application version 0.2.1")).toBeInTheDocument();
    expect(await screen.findByText("Current published release")).toBeInTheDocument();
    expect(screen.getByText("Published player release")).toBeInTheDocument();
    expect(screen.queryByText("No verified release source is configured.")).not.toBeInTheDocument();
    expect(screen.getByText("No maintenance schedule source is configured.")).toBeInTheDocument();
    expect(screen.getByText("No incident source is configured.")).toBeInTheDocument();
  });

  it("preserves corrected release-detail navigation without fake content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ currentVersion: "0.2.0", releases: [] }) }));
    renderWithQuery("PUB018");
    expect(screen.getByRole("link", { name: /Back to Release Notes/ })).toHaveAttribute("href", "/status/releases");
    expect(await screen.findByText("No player-visible release has been published.")).toBeInTheDocument();
  });

  it("RN-025 selects a published release from the concrete version route and links adjacent releases", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ currentVersion: "0.2.0", releases: [
      { version: "0.2.0", status: "PUBLISHED", title: "Current release", summary: "Current supplied release", releaseDate: "2026-08-10", previousVersion: "0.1.0", items: [] },
      { version: "0.1.0", status: "SUPERSEDED", title: "Earlier release", summary: "Earlier supplied release", releaseDate: "2026-08-01", previousVersion: null, items: [] },
    ] }) }));
    renderWithQuery("PUB018", "/status/releases/0.1.0");
    expect(await screen.findByRole("heading", { name: "Earlier release", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Release 0.1.0")).toBeInTheDocument();
    expect(screen.getByText("Earlier supplied release")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/status/releases/0.2.0");
    expect(screen.queryByText("Current supplied release")).not.toBeInTheDocument();
  });

  it("RN-024 renders the public archive in semantic order", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ currentVersion: "0.10.0", releases: [
      { version: "0.10.0", status: "PUBLISHED", title: "Newer release", summary: "Newer", releaseDate: "2026-08-10", previousVersion: "0.9.0", items: [] },
      { version: "0.9.0", status: "SUPERSEDED", title: "Older release", summary: "Older", releaseDate: "2026-08-01", previousVersion: null, items: [] },
    ] }) }));

    renderWithQuery("PUB017");

    expect((await screen.findAllByRole("link", { name: "Read release notes" })).map((link) => link.getAttribute("href"))).toEqual([
      "/status/releases/0.10.0",
      "/status/releases/0.9.0",
    ]);
  });
});
