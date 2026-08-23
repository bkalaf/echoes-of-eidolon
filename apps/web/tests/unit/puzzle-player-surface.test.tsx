import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlayerPuzzleSurface } from "../../src/components/puzzles/PlayerPuzzleSurface";
import { generateProductionPuzzle, getPublicProductionPuzzle } from "../../src/server/puzzle-production-generators";
import type { PublicRouteStage } from "../../src/server/puzzle-production-validation";

const secret = "player-surface-test-secret-00000000000000000000000000";

function puzzle(puzzleBlueprintId: "PZB-011" | "PZB-012" | "PZB-021" | "PZB-037") {
  return generateProductionPuzzle({
    generatorVersion: "1.0.0",
    puzzleBlueprintId,
    seed: "PLAYER-SURFACE-SEED",
    subjectKey: "PLAYER-SURFACE-SUBJECT",
  }, secret);
}

describe("canonical Player Puzzle Surface", () => {
  it("makes PZB-011 a coordinate interaction without precomputing the sum", async () => {
    const generated = puzzle("PZB-011");
    const [row, column] = generated.canonicalSolution.split(",").map(Number) as [number, number];
    const validate = vi.fn(async () => ({ correct: true }));

    render(<PlayerPuzzleSurface onValidate={validate} puzzle={getPublicProductionPuzzle(generated)} />);

    expect(screen.getByRole("heading", { name: "Ordinal Cancellation Files" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Sum" })).not.toBeInTheDocument();
    expect(screen.queryByText(/instance checksum|generator version|PZB-011/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Matrix A, row ${row}, column ${column}, value`) }));
    fireEvent.click(screen.getByRole("button", { name: "Check coordinate" }));
    await waitFor(() => expect(validate).toHaveBeenCalledWith({ kind: "coordinate", row, column }));
    expect(screen.getByRole("status")).toHaveTextContent("Coordinate accepted");
  });

  it("makes PZB-012 a structured set selection with understandable scope cards", async () => {
    const generated = puzzle("PZB-012");
    const members = generated.canonicalSolution.split("-").map(Number);
    const validate = vi.fn(async () => ({ correct: true }));

    render(<PlayerPuzzleSurface onValidate={validate} puzzle={getPublicProductionPuzzle(generated)} />);

    expect(screen.getByRole("heading", { name: "Set Union / Intersection Ambigram" })).toBeInTheDocument();
    expect(screen.getByText("Union", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Intersection", { selector: "span" })).toBeInTheDocument();
    for (const member of members) fireEvent.click(screen.getByRole("button", { name: `Select member ${member}` }));
    fireEvent.click(screen.getByRole("button", { name: "Check selected set" }));
    await waitFor(() => expect(validate).toHaveBeenCalledWith({ kind: "set", members }));
  });

  it("makes PZB-037 playable as audio with captions and an equivalent texture grid", () => {
    const generated = puzzle("PZB-037");
    const start = vi.fn();
    const stop = vi.fn();
    const oscillator = { connect: vi.fn(), frequency: { value: 0 }, start, stop, type: "sine" };
    const gain = { connect: vi.fn(), gain: { exponentialRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn() } };
    class AudioContextMock {
      currentTime = 0;
      destination = {};
      close = vi.fn();
      createGain = () => gain;
      createOscillator = () => oscillator;
    }
    vi.stubGlobal("AudioContext", AudioContextMock);

    render(<PlayerPuzzleSurface onValidate={vi.fn()} puzzle={getPublicProductionPuzzle(generated)} />);

    fireEvent.click(screen.getByRole("button", { name: "Play melody" }));
    expect(start).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Replay melody" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Melody captions" })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Texture-grid equivalent" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accessible equivalent" }));
    expect(screen.getByRole("table", { name: "Texture-grid equivalent" })).toBeInTheDocument();
    expect(screen.getByLabelText("Six hexadecimal characters")).toHaveAttribute("inputmode", "text");
  });

  it("makes PZB-021 derive the modules before route continuation and supports card ordering", async () => {
    const generated = puzzle("PZB-021");
    const route: PublicRouteStage = {
      cards: [
        { cardId: "card-2", notchCount: 2, symbol: "B" },
        { cardId: "card-1", notchCount: 1, symbol: "A" },
      ],
      instructions: "Order the recovered symbol cards by their notch counts.",
    };
    const resolveRoute = vi.fn(async () => route);
    const validate = vi.fn(async () => ({ correct: true }));

    render(<PlayerPuzzleSurface onResolveRoute={resolveRoute} onValidate={validate} puzzle={getPublicProductionPuzzle(generated)} />);

    expect(screen.getByRole("img", { name: "Pre-threshold typographic source artifact" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Module matrix table")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Threshold level"), { target: { value: "128" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue through recovered mark" }));
    await waitFor(() => expect(resolveRoute).toHaveBeenCalledWith(128));
    const cards = screen.getByRole("list", { name: "Symbol cards" });
    fireEvent.keyDown(within(cards).getAllByRole("listitem")[0]!, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Check ordered symbols" }));
    await waitFor(() => expect(validate).toHaveBeenCalledWith({ kind: "ordered-symbols", symbols: ["A", "B"], threshold: 128 }));
  });
});
