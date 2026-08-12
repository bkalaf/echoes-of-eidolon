import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../src/lib/auth-client", () => ({ authClient: { useSession: authMocks.useSession } }));

import { managedAssetUrl } from "../../src/content/managed-assets";
import { HomePage } from "../../src/screens/public/HomePage";

function renderHome() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HomePage /></QueryClientProvider>);
}

describe("public home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
  });

  it("renders the approved hero and all nine carousel features", () => {
    const { container } = renderHome();
    expect(screen.getByRole("heading", { name: /when the moons align/i })).toBeVisible();
    expect(container.querySelector(".hero > img")).toHaveAttribute("src", managedAssetUrl("feature.unique-and-powerful-story"));
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
    expect(screen.getByText("A subscription will never be required.")).toBeVisible();
    expect(container.querySelector(".hero > .hero-free-cta")).toBeInTheDocument();
    expect(container.querySelector(".home-screen > .free-band")).not.toBeInTheDocument();
    expect(screen.getAllByAltText("Echoes of Eidolon")).toHaveLength(1);
    expect(within(screen.getByRole("contentinfo")).queryByRole("link", { name: "Status" })).not.toBeInTheDocument();
  });

  it("moves through all nine features with controlled carousel navigation", () => {
    const scrollIntoView = vi.fn();
    const scrollTo = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    HTMLElement.prototype.scrollTo = scrollTo;
    renderHome();
    expect(screen.getByText("Feature 1 of 9")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next feature" }));
    expect(screen.getByText("Feature 2 of 9")).toBeVisible();
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "smooth", left: 0 });
    expect(scrollIntoView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Previous feature" }));
    expect(screen.getByText("Feature 1 of 9")).toBeVisible();
  });

  it("uses stable distinct faction-colored crests without the circular feature artwork", () => {
    Element.prototype.scrollIntoView = () => undefined;
    const { container } = renderHome();
    const assignments = [...container.querySelectorAll<HTMLElement>(".feature-card .region-crest")].map((crest) => ({
      asset: crest.dataset.crestAsset,
      color: crest.dataset.crestColor,
    }));

    expect(assignments).toHaveLength(9);
    expect(new Set(assignments.map(({ asset }) => asset)).size).toBe(9);
    expect(new Set(assignments.map(({ color }) => color))).toEqual(new Set(["blue", "yellow", "red"]));
    expect(container.querySelectorAll(".feature-card img")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Next feature" }));
    expect([...container.querySelectorAll<HTMLElement>(".feature-card .region-crest")].map((crest) => ({
      asset: crest.dataset.crestAsset,
      color: crest.dataset.crestColor,
    }))).toEqual(assignments);
  });

  it("shows only signed-out authentication controls on the public landing page", () => {
    renderHome();
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/auth/sign-in");
    expect(screen.getByRole("link", { name: "Sign Up" })).toHaveAttribute("href", "/auth/sign-up");
    expect(screen.queryByRole("link", { name: "Sign Out" })).not.toBeInTheDocument();
  });

  it("keeps the normal Home content and adds game navigation after player access is verified", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "player-1" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ betaEligible: true, canPlay: true, membershipEntitled: false, participationEligible: true, role: "member", voiceWindowSeconds: 60 }) }));
    renderHome();
    expect(await screen.findByRole("heading", { name: /when the moons align/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter Game" })).toHaveAttribute("href", "/game");
    expect(screen.getByRole("link", { name: "Account" })).toHaveClass("avatar-link");
    expect(screen.getByRole("link", { name: "Sign Out" })).toHaveAttribute("href", "/auth/sign-out");
    expect(await screen.findByRole("link", { name: "Donate" })).toHaveAttribute("href", "/donate");
    expect(screen.queryByRole("link", { name: "Sign In" })).not.toBeInTheDocument();
  });

  it("does not fabricate an account initial when the signed-in name is blank", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "player-1", name: "" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ betaEligible: true, canPlay: true, role: "member" }) }));
    renderHome();

    expect(await screen.findByRole("link", { name: "Account" })).not.toHaveTextContent("A");
  });

  it("keeps Home and Administration available to a non-player admin", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ betaEligible: false, canPlay: false, membershipEntitled: false, participationEligible: true, role: "admin", voiceWindowSeconds: 60 }) }));
    renderHome();
    expect(await screen.findByRole("heading", { name: /when the moons align/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Enter Game" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Donate" })).not.toBeInTheDocument();
  });

  it("does not collapse Home when player access verification fails", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderHome();

    expect(await screen.findByRole("heading", { name: /when the moons align/i })).toBeInTheDocument();
    expect(screen.getByText("Player access is temporarily unavailable.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Account" })).toBeVisible();
  });
});
