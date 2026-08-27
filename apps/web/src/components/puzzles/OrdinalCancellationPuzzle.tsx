import { memo, useCallback, useState } from "react";

import type { CancellationPlayerArtifact } from "../../server/puzzle-production-generators";
import type { ProductionPlayerSubmission } from "../../server/puzzle-production-validation";

function coordinateKey(row: number, column: number) {
  return `${row},${column}`;
}

const MatrixCell = memo(function MatrixCell({ active, column, name, onToggle, row, value }: {
  active: boolean;
  column: number;
  name: "A" | "B";
  onToggle: (row: number, column: number) => void;
  row: number;
  value: number;
}) {
  return <button
    aria-label={`Record ${name}, row ${row}, column ${column}, value ${value}`}
    aria-pressed={active}
    className="puzzle-matrix__cell"
    onClick={() => onToggle(row, column)}
    type="button"
  >{value > 0 ? `+${value}` : value}</button>;
});

export const OrdinalCancellationPuzzle = memo(function OrdinalCancellationPuzzle({ accessibleMode, artifact, onValidate }: {
  accessibleMode: boolean;
  artifact: CancellationPlayerArtifact;
  onValidate: (submission: ProductionPlayerSubmission) => Promise<{ correct: boolean }>;
}) {
  const [marked, setMarked] = useState<Set<string>>(() => new Set());
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("");

  const toggle = useCallback((row: number, column: number) => {
    const key = coordinateKey(row, column);
    setMarked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setStatus("");
  }, []);

  const matrix = (name: "A" | "B", values: number[][]) => <div className="puzzle-matrix-wrap">
    <h3>Record {name}</h3>
    <table aria-label={`Record ${name}`} className="puzzle-matrix puzzle-matrix--wide">
      <thead><tr><th scope="col">Row</th>{values[0]!.map((_, column) => <th key={column} scope="col">{column + 1}</th>)}</tr></thead>
      <tbody>{values.map((row, rowIndex) => <tr key={rowIndex}><th scope="row">{rowIndex + 1}</th>{row.map((value, columnIndex) => {
        const active = marked.has(coordinateKey(rowIndex + 1, columnIndex + 1));
        return <td key={columnIndex}><MatrixCell active={active} column={columnIndex + 1} name={name} onToggle={toggle} row={rowIndex + 1} value={value} /></td>;
      })}</tr>)}</tbody>
    </table>
  </div>;

  const submit = async () => {
    const markedCoordinates = [...marked].map((value) => {
      const [row, column] = value.split(",").map(Number) as [number, number];
      return { column, row };
    }).sort((left, right) => left.row - right.row || left.column - right.column);
    const result = await onValidate({ kind: "bitmap-code", markedCoordinates, value: answer });
    setStatus(result.correct ? "The six signs hold. The accord is complete." : "The records do not yet preserve that six-character reading.");
  };

  return <div className="stack">
    {accessibleMode
      ? <section aria-label="Paired signed records" className="puzzle-equivalent"><h3>Coordinate workbench</h3><p>Each control presents the two values at one coordinate. Mark any pair you want to keep.</p><div className="puzzle-paired-value-grid">{artifact.matrixA.flatMap((row, rowIndex) => row.map((value, columnIndex) => {
        const active = marked.has(coordinateKey(rowIndex + 1, columnIndex + 1));
        return <button aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}: record A ${value}; record B ${artifact.matrixB[rowIndex]![columnIndex]}`} aria-pressed={active} className="button" key={coordinateKey(rowIndex, columnIndex)} onClick={() => toggle(rowIndex + 1, columnIndex + 1)} type="button">R{rowIndex + 1} C{columnIndex + 1}</button>;
      }))}</div></section>
      : <div className="puzzle-matrix-pair puzzle-matrix-pair--stacked">{matrix("A", artifact.matrixA)}{matrix("B", artifact.matrixB)}</div>}
    <p aria-live="polite">{marked.size === 0 ? "No coordinates marked." : `${marked.size} coordinates marked.`}</p>
    <label className="field">Six-character reading<input aria-label="Six-character bitmap reading" autoCapitalize="characters" className="input puzzle-code-input" maxLength={6} onChange={(event) => { setAnswer(event.target.value.toLocaleUpperCase("en-US").replace(/[^A-H2-9]/g, "")); setStatus(""); }} pattern="[A-H2-9]{6}" placeholder="Six signs" value={answer} /></label>
    <button className="button button--gold" disabled={marked.size === 0 || answer.length !== 6} onClick={() => void submit()} type="button">Check the accord</button>
    <section aria-label="Printable cancellation worksheet" className="puzzle-print-worksheet"><h3>Marking worksheet</h3><div className="puzzle-print-grid">{artifact.matrixA.flatMap((row, rowIndex) => row.map((_, columnIndex) => <span key={coordinateKey(rowIndex, columnIndex)} />))}</div></section>
    {status && <p className={`notice ${status.startsWith("The six signs hold") ? "notice--good" : "notice--bad"}`} role="status">{status}</p>}
  </div>;
});
