import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PuzzlePrototypeLab } from "../../src/screens/admin/PuzzlePrototypeLab";

afterEach(() => vi.unstubAllGlobals());

describe("Puzzle Prototype Lab", () => {
  it("runs an answer-safe interactive sample without starting a timer", async () => {
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
      : { json: async () => ({ prototypes: [prototype], total: 70, timerStarted: false }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PuzzlePrototypeLab /></QueryClientProvider>);
    expect(await screen.findByRole("heading", { name: "Missing Commas Almanac" })).toBeInTheDocument();
    expect(screen.getByText("70 prototypes")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Sample answer"), { target: { value: "TEST-SUBMISSION" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate sample answer" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Timer started: no"));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/puzzles/preview", expect.objectContaining({ method: "POST" }));
  });
});
