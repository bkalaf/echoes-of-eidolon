import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { GameplayOverlayForScreen } from "../../src/screens/game/GameplayOverlays";
import { PublicPage } from "../../src/screens/public/PublicPage";

const companions = "ABCDEFGHIJKL".split("").map((companionKey) => ({ companionKey, name: `Companion ${companionKey}`, condition: "GREEN", conditionSentence: "Ready to travel.", transformed: companionKey === "A" }));
const inventory = Array.from({ length: 35 }, (_, index) => ({ itemId: `ITEM-${index + 1}`, name: `Item ${index + 1}`, quantity: index + 1 }));
const party = { partyId: "party", worldKey: "CONCORD", currency: { asset: "CURRENCY_MANE.svg", name: "Mane" }, purse: 100, withdrawal: { limit: 50, nextLimitIncreaseAtGameMinute: null, remaining: 50, used: 0 }, withdrawals: [], inventory, companions, currentLocation: { name: "Test Inn", services: ["INN"], innActions: { STAY: { cost: 10, rest: 1, morale: 1, comfort: 1 }, EAT: { cost: 2, rest: 0, morale: 1, comfort: 1 } } } };

function renderOverlay(screenId: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ party }) }));
  const entry = pageManifest.find((row) => row.screenId === screenId)!;
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><GameplayOverlayForScreen screen={entry} /></QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe("V4 player surfaces", () => {
  it("keeps the public Gameplay landing public and includes the governed placeholder and Atlas entry", () => {
    render(<PublicPage screen={pageManifest.find((row) => row.screenId === "PUB_GAME01_GAMEPLAY_LANDING")!} />);
    expect(screen.getByText("Gameplay content will be placed here as the game matures.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore the World Atlas" })).toHaveAttribute("href", "/gameplay/world-atlas");
  });

  it("renders twelve health cards with right-side portraits and transformed status", async () => {
    const { container } = renderOverlay("GAME_HEALTH01_PARTY_HEALTH");
    expect(await screen.findAllByText(/Ready to travel/)).toHaveLength(12);
    expect(container.querySelectorAll(".party-health-card")).toHaveLength(12);
    expect(screen.getByLabelText("Transformed")).toBeInTheDocument();
  });

  it("renders an unbounded 35-stack inventory in five columns without generic action controls", async () => {
    const { container } = renderOverlay("GAME_INV01_CONCORD");
    const grid = await screen.findByLabelText("Inventory stacks");
    expect(within(grid).getAllByRole("button")).toHaveLength(35);
    expect(container.querySelector(".inventory-grid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Use|Equip|Discard/ })).not.toBeInTheDocument();
  });

  it("keeps twelve companions and text chat reachable when voice is unavailable", async () => {
    renderOverlay("GAME_MTG01_MORNING_MEETING_V2");
    const roster = await screen.findByLabelText("Meeting companion roster");
    expect(within(roster).getAllByText(/Companion/)).toHaveLength(12);
    expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Talk" }));
    expect(await screen.findByText("Voice recording is unavailable in this browser. Text chat remains available.")).toBeInTheDocument();
  });
});
