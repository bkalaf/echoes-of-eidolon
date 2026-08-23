import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PuzzlePrototypeLab } from "../../src/screens/admin/PuzzlePrototypeLab";
import { createProductionQaSandbox, revealProductionPreviewSolution } from "../../src/server/puzzle-production-validation";
import { getPuzzlePrototypeCatalog } from "../../src/server/puzzle-prototypes";

const prototypeSecret = "test-only-prototype-lab-secret-000000000000000000000000";
const productionSecret = "test-only-production-lab-secret-00000000000000000000000";

function renderLab(fixedBlueprintId?: string) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PuzzlePrototypeLab fixedBlueprintId={fixedBlueprintId} /></QueryClientProvider>);
}

afterEach(() => vi.restoreAllMocks());

describe("Puzzle Prototype Lab", () => {
  it("keeps non-production Blueprints truthfully prototype-only", async () => {
    const response = getPuzzlePrototypeCatalog(prototypeSecret);
    const prototype = response.prototypes.find((entry) => entry.puzzleBlueprintId === "PZB-001")!;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ ...response, productionSandboxes: [] }), ok: true }));
    renderLab("PZB-001");
    expect(await screen.findByRole("heading", { name: prototype.title })).toBeInTheDocument();
    expect(screen.getByText("PROTOTYPE_ONLY")).toBeInTheDocument();
    expect(screen.queryByLabelText("Owner puzzle QA panel")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Document comparison surface" })).toBeInTheDocument();
  });

  it("mounts the canonical production renderer inside the complete owner QA shell", async () => {
    const response = getPuzzlePrototypeCatalog(prototypeSecret);
    const sandbox = createProductionQaSandbox("PZB-011", 0, productionSecret);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ ...response, productionSandboxes: [sandbox] }), ok: true }));
    renderLab("PZB-011");
    const ownerPanel = await screen.findByLabelText("Owner puzzle QA panel");
    expect(within(ownerPanel).getByRole("heading", { name: /PZB-011 · Ordinal Cancellation Files/ })).toBeInTheDocument();
    expect(within(ownerPanel).getByText("Generator version")).toBeInTheDocument();
    expect(within(ownerPanel).getByRole("button", { name: "Regenerate instance" })).toBeInTheDocument();
    expect(within(ownerPanel).getByRole("button", { name: "Reset player surface" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ordinal Cancellation Files player puzzle")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Sum" })).not.toBeInTheDocument();
  });

  it("fetches the expected answer separately and records player validation history", async () => {
    const response = getPuzzlePrototypeCatalog(prototypeSecret);
    const sandbox = createProductionQaSandbox("PZB-011", 0, productionSecret);
    const reveal = revealProductionPreviewSolution("PZB-011", 0, productionSecret);
    const fetchMock = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      if (String(request) === "/api/admin/puzzles/solution") return { json: async () => reveal, ok: true };
      if (init?.method === "POST") return { json: async () => ({ correct: false }), ok: true };
      return { json: async () => ({ ...response, productionSandboxes: [sandbox] }), ok: true };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderLab("PZB-011");
    fireEvent.click(await screen.findByRole("button", { name: "Reveal expected solution" }));
    expect(await screen.findByLabelText("Privileged expected solution")).toHaveTextContent(reveal.expectedSolution);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/puzzles/solution", expect.objectContaining({ method: "POST" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Matrix A, row 1, column 1, value/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Check coordinate" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Validation history" }).parentElement).toHaveTextContent("Incorrect"));
  });

  it("retains all nine interactive prototype family surfaces for the remaining 66", async () => {
    const response = getPuzzlePrototypeCatalog(prototypeSecret);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ ...response, productionSandboxes: [] }), ok: true }));
    renderLab();
    const select = await screen.findByLabelText("Puzzle Blueprint");
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
    const representatives = [...new Map(response.prototypes.filter((prototype) => !["PZB-011", "PZB-012", "PZB-021", "PZB-037"].includes(prototype.puzzleBlueprintId)).map((prototype) => [prototype.prototypeKind, prototype])).values()];
    expect(representatives).toHaveLength(9);
    for (const prototype of representatives) {
      fireEvent.change(select, { target: { value: prototype.puzzleBlueprintId } });
      const surface = await screen.findByRole("group", { name: surfaceNames[prototype.prototypeKind] });
      const control = within(surface).getAllByRole("button")[0]!;
      fireEvent.click(control);
      expect(control).toHaveAttribute("aria-pressed", "true");
    }
  });

  it("validates an answer-safe prototype sample without starting a timer", async () => {
    const response = getPuzzlePrototypeCatalog(prototypeSecret);
    const fetchMock = vi.fn(async (_request: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? { json: async () => ({ correct: true }), ok: true }
      : { json: async () => ({ ...response, productionSandboxes: [] }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderLab("PZB-001");
    fireEvent.change(await screen.findByLabelText("Sample answer"), { target: { value: "TEST-SUBMISSION" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate sample answer" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Timer started: no"));
  });
});
