import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { PuzzleAdminPage } from "../../src/screens/admin/PuzzleAdminPage";

function renderPuzzle(screenId: string, pathname?: string) {
  const screenEntry = pageManifest.find((entry) => entry.screenId === screenId)!;
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PuzzleAdminPage pathname={pathname ?? screenEntry.path ?? ""} screen={screenEntry} /></QueryClientProvider>);
}

function renderUnknownPuzzle() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PuzzleAdminPage pathname="/admin/puzzles/unknown" screen={{ originalPage: 0, page: 0, path: "/admin/puzzles/unknown", reviewOrder: 0, screenId: "UNKNOWN", source: "TEST", title: "Unknown" }} /></QueryClientProvider>);
}

describe("Puzzle Designer persistence projection", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("renders stored immutable versions and their exact hint order", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        blueprints: [{
          difficultyTier: "TIER_1_INITIATE",
          primaryFamily: "LOGIC_CONSTRAINT",
          title: "Supplied Puzzle",
          puzzleBlueprintId: "PUZZLE-SUPPLIED",
          versions: [{
            createdAt: "2026-08-10T00:00:00.000Z",
            generatorVersion: "4.0.0",
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
    expect(await screen.findByRole("cell", { name: "PUZZLE-SUPPLIED" })).toBeInTheDocument();
    expect(screen.getByText("DIRECTIONAL → GUIDED")).toBeInTheDocument();
    expect(screen.getByText("1 root")).toBeInTheDocument();
    expect(screen.queryByText(/70-root|exactly 70/)).not.toBeInTheDocument();
  });

  it("shows an honest empty bank without generating sample blueprints", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ blueprints: [], total: 0 }), ok: true }));
    renderPuzzle("ADM028");
    expect(await screen.findByText("No Puzzle Blueprint roots are stored.")).toBeInTheDocument();
    expect(screen.queryByText(/PUZZLE-001|Direction 0|Guide 0/)).not.toBeInTheDocument();
  });

  it("validates deterministic preview identity without starting a timer or fabricating puzzle content", async () => {
    const fetchMock = vi.fn().mockImplementation(async (request: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return { json: async () => ({ key: "deterministic-key", timerStarted: false }), ok: true };
      if (String(request) === "/api/admin/puzzles/preview") return { json: async () => ({ productionSandboxes: [], prototypes: [], total: 70, timerStarted: false }), ok: true };
      return { json: async () => ({ blueprints: [{ difficultyTier: "TIER_1_INITIATE", primaryFamily: "LOGIC_CONSTRAINT", title: "Supplied Puzzle", puzzleBlueprintId: "PUZZLE-SUPPLIED", versions: [{ createdAt: "2026-08-10T00:00:00.000Z", generatorVersion: "4.0.0", hints: [] }] }], total: 1 }), ok: true };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPuzzle("PZ003", "/admin/puzzles/PUZZLE-SUPPLIED/test");
    expect(await screen.findByText(/does not generate a puzzle instance or start/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Generator version"), { target: { value: "4.0.0" } });
    fireEvent.change(screen.getByLabelText("Campaign ID"), { target: { value: "CAM-1" } });
    fireEvent.change(screen.getByLabelText("Player ID"), { target: { value: "PLAYER-1" } });
    fireEvent.change(screen.getByLabelText("Seed"), { target: { value: "seed" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate preview identity" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Timer started: no"));
    expect(screen.queryByText(/accepted|ends at|answer:/i)).not.toBeInTheDocument();
  });

  it("keeps proposal component identifiers as provenance rather than a second registry", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderPuzzle("ADM029");
    expect(screen.getByText(/retained only as Action-B source provenance/)).toBeInTheDocument();
    expect(screen.queryByText("PUZCMP_MATRIX_LAB")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("runs an answer-safe working sample from the 70-prototype lab without starting a timer", async () => {
    const prototype = {
      puzzleBlueprintId: "PZB-001",
      title: "Missing Commas Almanac",
      concept: "Compare two records and align their omissions.",
      primaryFamily: "TEXT_LANGUAGE_LITERARY",
      secondaryFamilies: ["CRYPTO_NUMERIC_DATA"],
      difficultyTier: "TIER_1_INITIATE",
      generatorVersion: "1.0.0",
      answerFormat: "SIX_DIGIT_CODE",
      answerDerivation: "Align omissions.",
      estimatedSolveTime: "10–30 minutes",
      playerFacingModalities: ["TEXT"],
      accessibilityModalities: ["SCREEN_READER_DATA"],
      prototypeKind: "TEXT_COMPARE",
      controls: ["RESET"],
      cues: ["ALMANAC", "MARGIN", "SEAL-001"],
      decoys: ["123456"],
      hints: [
        { level: 1, kind: "DIRECTIONAL", text: "Compare the records." },
        { level: 2, kind: "GUIDED", text: "Align by token ordinal." },
      ],
      expectedSolvePath: ["Compare", "Align", "Submit"],
      sources: [],
      challenge: {
        instanceId: "sample-001",
        instructions: "Subtract 7 from each margin ordinal.",
        clues: ["margin ordinal 01 · 61", "margin ordinal 02 · 63"],
      },
    };
    const fetchMock = vi.fn().mockImplementation(async (_request: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? { json: async () => ({ correct: true, puzzleBlueprintId: "PZB-001", timerStarted: false }), ok: true }
      : { json: async () => ({ productionSandboxes: [], prototypes: [prototype], total: 70, timerStarted: false }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderPuzzle("ADM030");
    expect(await screen.findByRole("heading", { name: "Missing Commas Almanac" })).toBeInTheDocument();
    expect(screen.getByText("4 production · 66 prototype")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Sample answer"), { target: { value: "TEST-SUBMISSION" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate sample answer" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Timer started: no"));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/puzzles/preview", expect.objectContaining({ method: "POST" }));
  });

  it("does not reinterpret an unknown puzzle screen as an editor", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderUnknownPuzzle();
    expect(screen.getByRole("heading", { name: "Puzzle workflow unavailable" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
