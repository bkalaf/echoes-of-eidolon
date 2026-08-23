import { useState } from "react";

import type { PublicProductionPuzzle } from "../../server/puzzle-production-generators";
import type { ProductionPlayerSubmission } from "../../server/puzzle-production-validation";

type Carrier = Extract<PublicProductionPuzzle["carrier"], { kind: "ORDINAL_CANCELLATION_MATRIX" }>;

export function OrdinalCancellationPuzzle({ accessibleMode, carrier, onValidate }: {
  accessibleMode: boolean;
  carrier: Carrier;
  onValidate: (submission: ProductionPlayerSubmission) => Promise<{ correct: boolean }>;
}) {
  const [selected, setSelected] = useState<{ row: number; column: number }>();
  const [status, setStatus] = useState("");

  const matrix = (name: "A" | "B", values: number[][]) => <div className="puzzle-matrix-wrap">
    <h3>Matrix {name}</h3>
    <table aria-label={`Matrix ${name}`} className="puzzle-matrix">
      <thead><tr><th scope="col">Row</th>{values[0]!.map((_, column) => <th key={column} scope="col">{column + 1}</th>)}</tr></thead>
      <tbody>{values.map((row, rowIndex) => <tr key={rowIndex}><th scope="row">{rowIndex + 1}</th>{row.map((value, columnIndex) => {
        const active = selected?.row === rowIndex + 1 && selected.column === columnIndex + 1;
        return <td key={columnIndex}><button
          aria-label={`Matrix ${name}, row ${rowIndex + 1}, column ${columnIndex + 1}, value ${value}`}
          aria-pressed={active}
          className="puzzle-matrix__cell"
          onClick={() => { setSelected({ column: columnIndex + 1, row: rowIndex + 1 }); setStatus(""); }}
          type="button"
        >{value > 0 ? `+${value}` : value}</button></td>;
      })}</tr>)}</tbody>
    </table>
  </div>;

  const submit = async () => {
    if (!selected) return;
    const result = await onValidate({ column: selected.column, kind: "coordinate", row: selected.row });
    setStatus(result.correct ? "Coordinate accepted. The cancellation is exact." : "That coordinate does not cancel to zero. Keep comparing the same cell in both matrices.");
  };

  return <div className="stack">
    <p>Each position in Matrix A pairs with the same position in Matrix B. Find the single pair whose signed values cancel exactly.</p>
    {accessibleMode
      ? <section aria-label="Screen-reader matrix comparison" className="puzzle-equivalent"><h3>Row-by-row comparison</h3><ol>{carrier.screenReaderRows.map((row, index) => <li key={index}>{row}</li>)}</ol></section>
      : <div className="puzzle-matrix-pair">{matrix("A", carrier.matrixA)}{matrix("B", carrier.matrixB)}</div>}
    <p aria-live="polite">{selected ? `Selected coordinate: row ${selected.row}, column ${selected.column}.` : "No coordinate selected."}</p>
    <button className="button button--gold" disabled={!selected} onClick={() => void submit()} type="button">Check coordinate</button>
    {status && <p className={`notice ${status.startsWith("Coordinate accepted") ? "notice--good" : "notice--bad"}`} role="status">{status}</p>}
  </div>;
}
