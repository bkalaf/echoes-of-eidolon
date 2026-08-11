import { fireEvent, render, screen, within } from "@testing-library/react";
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

function renderGameScreen(screenEntry: ReturnType<typeof gameScreen>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <GamePage screen={screenEntry} />
    </QueryClientProvider>,
  );
}

function playerAccess(input: { betaEligible: boolean; canPlay: boolean; role: string }) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (request: RequestInfo | URL) => {
    const url = String(request);
    if (url.includes("/api/player/runtime")) return { json: async () => ({ exits: [], location: null, nearby: [], sessionId: null, turns: [] }), ok: true };
    if (url.includes("/api/player/puzzles")) return { json: async () => ({ puzzles: [] }), ok: true };
    if (url.includes("/api/player/calendar")) return { json: async () => ({ months: [] }), ok: true };
    return { json: async () => input, ok: true };
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

  it("loads player-safe context and enables the bounded runtime input", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGame("GAME008");

    expect(await screen.findByRole("textbox", { name: "Speak or type freely" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Nearby" })).toBeInTheDocument();
    expect(await screen.findByText("No player-known nearby records.")).toBeInTheDocument();
    expect(screen.queryByText(/Mae|Archivist|18:42/)).not.toBeInTheDocument();
  });

  it("does not offer acceptance when no Puzzle is assigned to the current campaign", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGame("GAME011");

    expect(await screen.findByText(/No Puzzle Blueprint is assigned/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept challenge" })).not.toBeInTheDocument();
    expect(screen.queryByText(/15 minutes|Available in sequence|18:42 remaining/)).not.toBeInTheDocument();
  });

  it("starts a persisted challenge only after explicit acceptance and renders its server-owned window", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    let accepted = false;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      if (url.includes("/api/player/access")) return { json: async () => ({ betaEligible: true, canPlay: true, role: "member" }), ok: true };
      if (url.includes("/api/player/puzzles") && init?.method === "POST") { accepted = true; return { json: async () => ({}), ok: true }; }
      if (url.includes("/api/player/puzzles")) return { json: async () => ({ puzzles: [{ acceptance: accepted ? { acceptedAt: "2026-08-10T00:00:00.000Z", endsAt: "2099-08-10T00:00:00.000Z", puzzleChallengeAcceptedId: "ACCEPT-1", remainingSeconds: 2_160_000 } : null, difficultyTier: "TIER_1_INITIATE", family: "MUSIC", generatorVersion: 3, hints: accepted ? [{ kind: "DIRECTIONAL", level: 1, template: "Listen east." }, { kind: "GUIDED", level: 2, template: "Compare the second phrase." }] : [], name: "Assigned Trial", puzzleBlueprintId: "PUZZLE-1" }] }), ok: true };
      return { json: async () => ({ exits: [], location: null, nearby: [], sessionId: null, turns: [] }), ok: true };
    }));
    renderGame("GAME011");

    expect(await screen.findByText("Assigned Trial")).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept challenge" }));
    expect(await screen.findByRole("timer")).toHaveTextContent(/seconds remaining/);
    expect(screen.getByText("DIRECTIONAL").closest("li")).toHaveTextContent("Listen east.");
    expect(screen.getByText("GUIDED").closest("li")).toHaveTextContent("Compare the second phrase.");
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
    expect(screen.getByText("Yearsend 25")).toBeInTheDocument();
    expect(screen.getByText("Yearsend 26")).toBeInTheDocument();
    expect(screen.getByText("Yearsend 27")).toBeInTheDocument();
    expect(screen.queryByText("Story day 1")).not.toBeInTheDocument();
    for (const inventedName of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.queryByText(inventedName, { exact: true })).not.toBeInTheDocument();
    }
  });

  it.each([
    ["GAME002", /Knowledge records, discovery state/],
    ["GAME004", /No discovered Tome list/],
    ["GAME012", /Companion identities, health, relationships, and Heirloom details require player-runtime source rows/],
  ])("fails closed for unowned player data in %s", async (screenId, message) => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGame(screenId);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("does not expose internal Companion WorldKey structure to the player", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGame("GAME012");

    expect(await screen.findByRole("heading", { name: "Companions" })).toBeInTheDocument();
    for (const internalLabel of ["Concord Protagonist", "Ruin Protagonist", "Schism Protagonist", "three distinct world-matching Protagonists"]) {
      expect(screen.queryByText(internalLabel, { exact: true })).not.toBeInTheDocument();
    }
  });

  it("places unavailable Tome page numbers at the bottom outer corners", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGame("GAME004");

    expect(await screen.findByLabelText("Left page number unavailable")).toHaveClass("tome-page-number--left");
    expect(screen.getByLabelText("Right page number unavailable")).toHaveClass("tome-page-number--right");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("reuses the textured Atlas globe without disclosing unowned player markers", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGame("GAME005");

    const globe = await screen.findByRole("application", { name: /Interactive Eidolon globe/ });
    expect(globe.querySelector("canvas")).toBeInTheDocument();
    expect(screen.getByText(/Player-safe layers, discovered geography/)).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Player-safe coordinate overlays are unavailable.");
    expect(globe.querySelectorAll("[data-globe-marker]")).toHaveLength(0);
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

    expect(await screen.findByRole("textbox", { name: "Speak or type freely" })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Player eligibility required" })).not.toBeInTheDocument();
  });

  it("fails closed when player eligibility cannot be verified", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderGame("GAM001");

    expect(await screen.findByRole("heading", { name: "Game access unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Speak or type freely" })).not.toBeInTheDocument();
  });

  it("fails closed for an unknown authenticated game screen", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGameScreen({ ...gameScreen("GAME015"), screenId: "GAME_UNKNOWN" });

    expect(await screen.findByRole("heading", { name: "Game screen unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Game Settings" })).not.toBeInTheDocument();
  });
});
