import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: { useSession: authMocks.useSession },
}));

import { pageManifest } from "../../src/lib/page-manifest";
import { GamePage } from "../../src/screens/game/GamePage";

function gameScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

describe("game runtime boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not expose player or story data without an authenticated session", () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    render(<GamePage screen={gameScreen("GAM001")} />);

    expect(screen.getByRole("heading", { name: "Sign in required" })).toBeInTheDocument();
    expect(screen.queryByText(/Mae'vyri|Harbor Gate|18:42/)).not.toBeInTheDocument();
  });

  it("keeps freeform interaction and runtime context unavailable without a runtime owner", () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    render(<GamePage screen={gameScreen("GAME008")} />);

    expect(screen.getByRole("textbox", { name: "Speak or type freely" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send unavailable" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Nearby" })).toBeInTheDocument();
    expect(screen.getByText("No player-known nearby records are available.")).toBeInTheDocument();
    expect(screen.queryByText(/Mae|Archivist|18:42/)).not.toBeInTheDocument();
  });

  it("does not invent Witness trial timing, hints, retry, or acceptance", () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    render(<GamePage screen={gameScreen("GAME011")} />);

    expect(screen.getByRole("button", { name: "Accept unavailable" })).toBeDisabled();
    expect(screen.getByText(/duration, hint sequence, retry rules/)).toBeInTheDocument();
    expect(screen.queryByText(/15 minutes|Available in sequence|18:42 remaining/)).not.toBeInTheDocument();
  });

  it("renders only the exact supplied calendar structure", () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    render(<GamePage screen={gameScreen("GAME014")} />);

    const calendar = screen.getByRole("grid", { name: "Calendar month" });
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
  ])("fails closed for unowned player data in %s", (screenId, message) => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    render(<GamePage screen={gameScreen(screenId)} />);

    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
