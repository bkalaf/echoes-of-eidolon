import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getActiveMemberRole: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
    organization: { getActiveMemberRole: authMocks.getActiveMemberRole },
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

describe("game runtime boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getActiveMemberRole.mockResolvedValue({ data: { role: "member" }, error: null });
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
    ["GAME005", /Player-safe layers, discovered geography/],
    ["GAME012", /exact Heirloom controlled values are owner-deferred/],
  ])("fails closed for unowned player data in %s", async (screenId, message) => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    renderGame(screenId);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("does not grant game access to an authenticated user without membership", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    authMocks.getActiveMemberRole.mockResolvedValue({ data: { role: null }, error: null });
    renderGame("GAM001");

    expect(await screen.findByRole("heading", { name: "Member access required" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Speak or type freely" })).not.toBeInTheDocument();
  });

  it.each(["admin", "owner"])("grants game access to the %s organization role", async (role) => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    authMocks.getActiveMemberRole.mockResolvedValue({ data: { role }, error: null });
    renderGame("GAME008");

    expect(await screen.findByRole("textbox", { name: "Speak or type freely" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Member access required" })).not.toBeInTheDocument();
  });

  it("fails closed when the organization role cannot be verified", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    authMocks.getActiveMemberRole.mockResolvedValue({
      data: null,
      error: { message: "authorization unavailable" },
    });
    renderGame("GAM001");

    expect(await screen.findByRole("heading", { name: "Game access unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Speak or type freely" })).not.toBeInTheDocument();
  });
});
