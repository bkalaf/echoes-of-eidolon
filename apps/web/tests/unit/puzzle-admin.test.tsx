import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { PuzzleAdminPage } from "../../src/screens/admin/PuzzleAdminPage";

function renderPuzzle(screenId: string) {
  const screenEntry = pageManifest.find((entry) => entry.screenId === screenId)!;
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PuzzleAdminPage screen={screenEntry} /></QueryClientProvider>);
}

function renderUnknownPuzzle() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PuzzleAdminPage screen={{ originalPage: 0, page: 0, path: "/admin/puzzles/unknown", reviewOrder: 0, screenId: "UNKNOWN", source: "TEST", title: "Unknown" }} /></QueryClientProvider>);
}

describe("Puzzle Designer persistence projection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders stored immutable versions and their exact hint order", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        blueprints: [{
          difficultyTier: "TIER_1_INITIATE",
          family: "LOGIC_CONSTRAINT",
          puzzleBlueprintId: "PUZZLE-SUPPLIED",
          versions: [{
            createdAt: "2026-08-10T00:00:00.000Z",
            generatorVersion: 4,
            hints: [
              { kind: "DIRECTIONAL", level: 1, template: "Supplied direction" },
              { kind: "GUIDED", level: 2, template: "Supplied guide" },
            ],
          }],
        }],
        total: 1,
      }),
      ok: true,
    }));
    renderPuzzle("PZ001");
    expect(await screen.findByText("PUZZLE-SUPPLIED")).toBeInTheDocument();
    expect(screen.getByText("DIRECTIONAL → GUIDED")).toBeInTheDocument();
    expect(screen.getByText("1 / 70 roots")).toBeInTheDocument();
    expect(screen.getByText(/Missing roots are not generated/)).toBeInTheDocument();
  });

  it("shows an honest empty bank without generating sample blueprints", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ blueprints: [], total: 0 }), ok: true }));
    renderPuzzle("ADM028");
    expect(await screen.findByText("No Puzzle Blueprint roots are stored.")).toBeInTheDocument();
    expect(screen.queryByText(/PUZZLE-001|Direction 0|Guide 0/)).not.toBeInTheDocument();
  });

  it("does not start a timer or fabricate preview content from an editor screen", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ blueprints: [], total: 0 }), ok: true }));
    renderPuzzle("PZ003");
    expect(await screen.findByText(/Preview generation and editor writes remain unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/accepted|ends at|answer:/i)).not.toBeInTheDocument();
  });

  it("does not reinterpret an unknown puzzle screen as an editor", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderUnknownPuzzle();
    expect(screen.getByRole("heading", { name: "Puzzle workflow unavailable" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
