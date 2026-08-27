import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlayerPuzzleSurface } from "../../src/components/puzzles/PlayerPuzzleSurface";
import { generateProductionPuzzle, getPublicProductionPuzzle } from "../../src/server/puzzle-production-generators";
import type { PublicRouteStage } from "../../src/server/puzzle-production-validation";

const secret = "player-surface-test-secret-00000000000000000000000000";

function puzzle(puzzleBlueprintId: "PZB-011" | "PZB-012" | "PZB-021" | "PZB-037") {
  return generateProductionPuzzle({ generatorVersion: "1.1.0", puzzleBlueprintId, seed: "PLAYER-SURFACE-SEED", subjectKey: "PLAYER-SURFACE-SUBJECT" }, secret);
}

describe("canonical Player Puzzle Surface", () => {
  it("makes The Quiet Accord an exact bitmap interaction without precomputed sums", async () => {
    const generated = puzzle("PZB-011");
    if (generated.carrier.kind !== "ORDINAL_CANCELLATION_MATRIX") throw new Error("wrong carrier");
    const markedCoordinates = generated.carrier.matrixA.flatMap((row, rowIndex) => row.flatMap((value, columnIndex) => value + generated.carrier.matrixB[rowIndex]![columnIndex]! === 0 ? [{ row: rowIndex + 1, column: columnIndex + 1 }] : []));
    const validate = vi.fn(async () => ({ correct: true }));

    const { container } = render(<PlayerPuzzleSurface onValidate={validate} puzzle={getPublicProductionPuzzle(generated)} />);

    expect(screen.getByRole("heading", { name: "The Quiet Accord" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Sum" })).not.toBeInTheDocument();
    expect(screen.queryByText(/instance checksum|generator version|PZB-011/i)).not.toBeInTheDocument();
    const recordAButtons = container.querySelectorAll<HTMLButtonElement>('table[aria-label="Record A"] button');
    await act(async () => {
      for (const coordinate of markedCoordinates) recordAButtons[(coordinate.row - 1) * 31 + coordinate.column - 1]!.click();
    });
    fireEvent.change(screen.getByLabelText("Six-character bitmap reading"), { target: { value: generated.canonicalSolution } });
    fireEvent.click(screen.getByRole("button", { name: "Check the accord" }));
    await waitFor(() => expect(validate).toHaveBeenCalledWith({ kind: "bitmap-code", markedCoordinates, value: generated.canonicalSolution }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("accord is complete"));

    fireEvent.click(screen.getByRole("button", { name: "Hint 1" }));
    expect(screen.getByText(/lockstep/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hint 2" }));
    expect(screen.getByText(/exact cancellations/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset puzzle" }));
    expect(screen.getByText("No coordinates marked.")).toBeInTheDocument();
  }, 30_000);

  it("makes The Third Reading a structured set selection while preserving literal accessible marks", async () => {
    const generated = puzzle("PZB-012");
    const members = generated.canonicalSolution.split("-").map(Number);
    const validate = vi.fn(async () => ({ correct: true }));

    render(<PlayerPuzzleSurface onValidate={validate} puzzle={getPublicProductionPuzzle(generated)} />);

    expect(screen.getByRole("heading", { name: "The Third Reading" })).toBeInTheDocument();
    expect(screen.queryByText(/^Union$/)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/U mark|I mark/).length).toBeGreaterThan(0);
    for (const member of members) fireEvent.click(screen.getByRole("button", { name: `Select member ${member}` }));
    fireEvent.click(screen.getByRole("button", { name: "Check selected set" }));
    await waitFor(() => expect(validate).toHaveBeenCalledWith({ kind: "set", members }));
    fireEvent.click(screen.getByRole("button", { name: "Accessible equivalent" }));
    expect(screen.getAllByText(/mark/).length).toBeGreaterThan(0);
  }, 30_000);

  it("makes Glass Vespers playable as score and audio, then gates the derived glass field", async () => {
    const generated = puzzle("PZB-037");
    const start = vi.fn();
    const stop = vi.fn();
    const oscillator = { connect: vi.fn(), frequency: { value: 0 }, start, stop, type: "sine" };
    const gain = { connect: vi.fn(), gain: { exponentialRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn() } };
    class AudioContextMock {
      currentTime = 0;
      destination = {};
      close = vi.fn();
      resume = vi.fn();
      suspend = vi.fn();
      createGain = () => gain;
      createOscillator = () => oscillator;
    }
    vi.stubGlobal("AudioContext", AudioContextMock);
    const validate = vi.fn(async () => ({ correct: true }));

    const { container } = render(<PlayerPuzzleSurface onValidate={validate} puzzle={getPublicProductionPuzzle(generated)} />);

    expect(container.querySelectorAll(".puzzle-score-page")).toHaveLength(4);
    expect(screen.queryByRole("img", { name: "Developed 32 by 4 glass pane" })).not.toBeInTheDocument();
    const keyboardTransport = screen.getByRole("region", { name: "Glass Vespers keyboard transport" });
    fireEvent.keyDown(keyboardTransport, { key: " " });
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    fireEvent.keyDown(keyboardTransport, { key: " " });
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Retained notes per pane"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Control separator"), { target: { value: "G" } });
    expect(screen.getByRole("img", { name: "Developed 32 by 4 glass pane" }).children).toHaveLength(128);
    fireEvent.click(screen.getByRole("button", { name: "Accessible equivalent" }));
    expect(screen.getByRole("table", { name: "Note-event table" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Texture on-off grid" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Six hexadecimal characters"), { target: { value: generated.canonicalSolution.toLowerCase() } });
    fireEvent.click(screen.getByRole("button", { name: "Read the glass" }));
    await waitFor(() => expect(validate).toHaveBeenCalledWith({ kind: "hex", value: generated.canonicalSolution.toLowerCase() }));
  }, 30_000);

  it("makes The Pall derive the pattern before the atmospheric passage and supports keyboard card ordering", async () => {
    const generated = puzzle("PZB-021");
    const route: PublicRouteStage = {
      cards: [{ cardId: "card-2", notchCount: 2, symbol: "B" }, { cardId: "card-1", notchCount: 1, symbol: "A" }],
      instructions: "Order the recovered symbol cards by their notch counts.",
    };
    const resolveRoute = vi.fn(async () => route);
    const validate = vi.fn(async () => ({ correct: true }));

    render(<PlayerPuzzleSurface onResolveRoute={resolveRoute} onValidate={validate} puzzle={getPublicProductionPuzzle(generated)} />);

    expect(screen.getByRole("img", { name: "Microtext page" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Current light and dark reduction")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Light-dark separation"), { target: { value: "128" } });
    fireEvent.click(screen.getByRole("button", { name: "Enter the recovered passage" }));
    await waitFor(() => expect(resolveRoute).toHaveBeenCalledWith(128));
    const cards = screen.getByRole("list", { name: "Symbol cards" });
    fireEvent.keyDown(within(cards).getAllByRole("listitem")[0]!, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Try this order" }));
    await waitFor(() => expect(validate).toHaveBeenCalledWith({ kind: "ordered-symbols", symbols: ["A", "B"], threshold: 128 }));
    fireEvent.click(screen.getByRole("button", { name: "Accessible equivalent" }));
    expect(screen.getByRole("table", { name: "Source tone table" })).toBeInTheDocument();
  }, 30_000);
});
