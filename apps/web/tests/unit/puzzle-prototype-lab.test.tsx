import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PuzzlePrototypeLab } from "../../src/screens/admin/PuzzlePrototypeLab";
import { getProductionPreviews } from "../../src/server/puzzle-production-generators";
import { getPuzzlePrototypeCatalog } from "../../src/server/puzzle-prototypes";

afterEach(() => vi.unstubAllGlobals());

describe("Puzzle Prototype Lab", () => {
  it("renders an answer-free production family carrier for a non-tutorial blueprint", async () => {
    const prototype = getPuzzlePrototypeCatalog("test-only-prototype-lab-secret-000000000000000000000000").prototypes.find((entry) => entry.puzzleBlueprintId === "PZB-001")!;
    const productionPuzzle = {
      accessibilityModes: ["SCREEN_READER_DATA"],
      carrier: { kind: "TEXT_DOCUMENT_PAIR", decodeOffset: 7, documentA: [{ encodedValue: 72, ordinal: 0 }], documentB: [{ encodedValue: 73, ordinal: 1 }], instructions: "Order and decode." },
      familyKind: "TEXT_DOCUMENT_PAIR",
      generatorVersion: "1.0.0",
      hints: prototype.hints,
      instanceChecksum: "b".repeat(64),
      instanceId: "production-instance",
      liveRuntimeRecordsCreated: 0,
      primaryFamily: "TEXT_LANGUAGE_LITERARY",
      puzzleBlueprintId: "PZB-001",
      timerStarted: false,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ productionPuzzles: [productionPuzzle], prototypes: [prototype], total: 70, timerStarted: false }), ok: true }));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PuzzlePrototypeLab fixedBlueprintId="PZB-001" /></QueryClientProvider>);
    const heading = await screen.findByRole("heading", { name: "Production generator 1.0.0" });
    const production = heading.closest("section")!;
    expect(within(production).getByText("TEXT_DOCUMENT_PAIR")).toBeInTheDocument();
    expect(within(production).getByRole("list", { name: "Text document pair carrier" })).toBeInTheDocument();
    expect(within(production).getByText("Runtime records: 0 · Timer started: no")).toBeInTheDocument();
  });

  it("renders the production tutorial carrier and accessibility surface without runtime state", async () => {
    const prototype = getPuzzlePrototypeCatalog("test-only-prototype-lab-secret-000000000000000000000000").prototypes.find((entry) => entry.puzzleBlueprintId === "PZB-011")!;
    const productionTutorial = {
      accessibilityModes: ["SCREEN_READER_DATA", "KEYBOARD_ONLY", "HIGH_CONTRAST", "PRINTABLE_WORKSHEET"],
      carrier: { kind: "ORDINAL_CANCELLATION_MATRIX", instructions: "Add corresponding cells.", matrixA: [[1, 2], [3, 4]], matrixB: [[5, 6], [7, -4]], screenReaderRows: ["row 1", "row 2"] },
      generatorVersion: "1.0.0",
      instanceChecksum: "a".repeat(64),
      instanceId: "tutorial-instance",
      liveRuntimeRecordsCreated: 0,
      puzzleBlueprintId: "PZB-011",
      timerStarted: false,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ productionTutorials: [productionTutorial], prototypes: [prototype], total: 70, timerStarted: false }), ok: true }));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PuzzlePrototypeLab fixedBlueprintId="PZB-011" /></QueryClientProvider>);
    const heading = await screen.findByRole("heading", { name: "Production tutorial generator 1.0.0" });
    const production = heading.closest("section")!;
    expect(within(production).getByRole("table", { name: "Ordinal cancellation matrices" })).toBeInTheDocument();
    expect(within(production).getByText("SCREEN_READER_DATA · KEYBOARD_ONLY · HIGH_CONTRAST · PRINTABLE_WORKSHEET")).toBeInTheDocument();
    expect(within(production).getByText("Runtime records: 0 · Timer started: no")).toBeInTheDocument();
  });

  it("renders accessible production carriers for all nine method families", async () => {
    const response = getPuzzlePrototypeCatalog("test-only-prototype-lab-secret-000000000000000000000000");
    const productionPuzzles = getProductionPreviews("test-only-production-lab-secret-00000000000000000000000");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ ...response, productionPuzzles }), ok: true }));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PuzzlePrototypeLab /></QueryClientProvider>);
    const select = await screen.findByLabelText("Prototype");
    const expectedRoles = new Map([
      ["TEXT_DOCUMENT_PAIR", ["list", "Text document pair carrier"]],
      ["NUMERIC_LEDGER", ["table", "Numeric ledger carrier"]],
      ["VISUAL_SHAPE_LAYERS", ["list", "Color-independent shape layer carrier"]],
      ["SPATIAL_ROUTE_BOARD", ["group", "Keyboard-operable spatial route carrier"]],
      ["AUDIO_CAPTION_SEQUENCE", ["list", "Captioned audio sequence carrier"]],
      ["LOGIC_CONSTRAINT_GRID", ["table", "Logic constraint carrier"]],
      ["RESEARCH_CLAIM_CHAIN", ["list", "Research claim and citation carrier"]],
      ["MECHANISM_REGISTER_BOARD", ["group", "Discrete mechanism register carrier"]],
      ["CROSS_MODAL_SIGNAL_PAIRS", ["list", "Equivalent cross-modal signal carrier"]],
    ] as const);
    const representatives = [...new Map(productionPuzzles.filter((puzzle) => expectedRoles.has(puzzle.carrier.kind as never)).map((puzzle) => [puzzle.carrier.kind, puzzle])).values()];
    expect(representatives).toHaveLength(9);
    for (const production of representatives) {
      fireEvent.change(select, { target: { value: production.puzzleBlueprintId } });
      const [role, name] = expectedRoles.get(production.carrier.kind as never)!;
      const carrier = await screen.findByRole(role, { name });
      expect(carrier).toBeInTheDocument();
      expect(within(carrier.closest("section")!).getByText(production.accessibilityModes.join(" · "))).toBeInTheDocument();
    }
  });

  it("exercises every family surface and exposes its declared accessibility equivalents", async () => {
    const response = getPuzzlePrototypeCatalog("test-only-prototype-lab-secret-000000000000000000000000");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => response, ok: true }));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PuzzlePrototypeLab /></QueryClientProvider>);
    const select = await screen.findByLabelText("Prototype");
    const surfaceNames = {
      TEXT_COMPARE: "Document comparison surface",
      DATA_TRANSFORM: "Data transformation surface",
      VISUAL_LAYER: "Color-independent visual layer surface",
      SPATIAL_BOARD: "Keyboard-operable spatial board",
      AUDIO_SEQUENCE: "Captioned audio sequence",
      CONSTRAINT_GRID: "Constraint matrix",
      SOURCE_CHAIN: "Claim and source chain",
      MECHANISM_BOARD: "Discrete mechanism board",
      CROSS_MODAL: "Equivalent cross-modal surface",
    } as const;
    const representatives = [...new Map(response.prototypes.map((prototype) => [prototype.prototypeKind, prototype])).values()];
    expect(representatives).toHaveLength(9);
    for (const prototype of representatives) {
      fireEvent.change(select, { target: { value: prototype.puzzleBlueprintId } });
      expect(await screen.findByRole("heading", { name: prototype.title })).toBeInTheDocument();
      expect(screen.getByText(prototype.accessibilityModalities.join(" · "))).toBeInTheDocument();
      const surface = screen.getByRole("group", { name: surfaceNames[prototype.prototypeKind] });
      const control = within(surface).getAllByRole("button")[0]!;
      fireEvent.click(control);
      expect(control).toHaveAttribute("aria-pressed", "true");
    }
  });

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
