import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
    useSession: authMocks.useSession,
  },
}));

import { pageManifest } from "../../src/lib/page-manifest";
import { GamePage } from "../../src/screens/game/GamePage";

function gameScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

function renderGame(screenId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <GamePage screen={gameScreen(screenId)} />
    </QueryClientProvider>,
  );
}

function playerAccess(input: { betaEligible: boolean; canPlay: boolean; role: string }) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    json: async () => input,
    ok: true,
  }));
}

describe("game runtime boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playerAccess({ betaEligible: true, canPlay: true, role: "member" });
  });

  it("does not expose player or story data without an authenticated session", () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    renderGame("GAM001");

    expect(screen.getByRole("heading", { name: "Sign in required" })).toBeInTheDocument();
    expect(screen.queryByText(/Mae'vyri|Harbor Gate|18:42/)).not.toBeInTheDocument();
  });

  it("keeps freeform interaction and runtime context unavailable without a runtime owner", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGame("GAME008");

    expect(await screen.findByRole("textbox", { name: "Speak or type freely" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send unavailable" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Nearby" })).toBeInTheDocument();
    expect(screen.getByText("No player-known nearby records are available.")).toBeInTheDocument();
    expect(screen.queryByText(/Mae|Archivist|18:42/)).not.toBeInTheDocument();
  });

  it("does not invent Witness trial timing, hints, retry, or acceptance", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGame("GAME011");

    expect(await screen.findByRole("button", { name: "Accept unavailable" })).toBeDisabled();
    expect(screen.getByText(/duration, hint sequence, retry rules/)).toBeInTheDocument();
    expect(screen.queryByText(/15 minutes|Available in sequence|18:42 remaining/)).not.toBeInTheDocument();
  });

  it("renders only the exact supplied calendar structure", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGame("GAME014");

    const calendar = await screen.findByRole("grid", { name: "Calendar month" });
    expect(within(calendar).getAllByText(/Counted weekday/)).toHaveLength(8);
    expect(within(calendar).getAllByText(/^\d+$/)).toHaveLength(27);
    expect(screen.getByLabelText("Pre-year story days").querySelectorAll("span")).toHaveLength(3);
    expect(screen.getByText(/18 months per year · 27 days per month/)).toBeInTheDocument();
    expect(screen.getByText(/Sonntag is hidden and excluded/)).toBeInTheDocument();
    for (const inventedName of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.queryByText(inventedName, { exact: true })).not.toBeInTheDocument();
    }
  });

  it.each([
    ["GAME002", /Knowledge records, discovery state/],
    ["GAME004", /No discovered Tome list/],
    ["GAME012", /exact Heirloom controlled values are owner-deferred/],
  ])("fails closed for unowned player data in %s", async (screenId, message) => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGame(screenId);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("reuses the textured Atlas globe without disclosing unowned player markers", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGame("GAME005");

    const globe = await screen.findByRole("application", { name: /Interactive Eidolon globe/ });
    expect(globe.querySelector("img")).toHaveAttribute("src", expect.stringMatching(/digitaloceanspaces\.com\/assets\/[a-f0-9]{64}\.png$/));
    expect(screen.getByText(/Player-safe layers, discovered geography/)).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Player-safe coordinate overlays are unavailable.");
    expect(globe.querySelectorAll("button")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Player overlays unavailable" })).toBeDisabled();
  });

  it("does not grant game access to an authenticated user without beta eligibility", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    playerAccess({ betaEligible: false, canPlay: false, role: "user" });
    renderGame("GAM001");

    expect(await screen.findByRole("heading", { name: "Player eligibility required" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Speak or type freely" })).not.toBeInTheDocument();
  });

  it("does not infer player eligibility from the admin authorization role", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    playerAccess({ betaEligible: false, canPlay: false, role: "admin" });
    renderGame("GAME008");

    expect(await screen.findByRole("heading", { name: "Player eligibility required" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Speak or type freely" })).not.toBeInTheDocument();
  });

  it("grants the owner access without a separate participation decision", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    playerAccess({ betaEligible: false, canPlay: true, role: "owner" });
    renderGame("GAME008");

    expect(await screen.findByRole("textbox", { name: "Speak or type freely" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Player eligibility required" })).not.toBeInTheDocument();
  });

  it("fails closed when player eligibility cannot be verified", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderGame("GAM001");

    expect(await screen.findByRole("heading", { name: "Game access unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Speak or type freely" })).not.toBeInTheDocument();
  });
});
