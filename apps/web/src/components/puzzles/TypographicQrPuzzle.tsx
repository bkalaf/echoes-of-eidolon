import { memo, useMemo, useState, type KeyboardEvent } from "react";

import type { PallPlayerArtifact } from "../../server/puzzle-production-generators";
import type { ProductionPlayerSubmission, PublicRouteStage } from "../../server/puzzle-production-validation";

export const TypographicQrPuzzle = memo(function TypographicQrPuzzle({ accessibleMode, artifact, onResolveRoute, onValidate }: {
  accessibleMode: boolean;
  artifact: PallPlayerArtifact;
  onResolveRoute: (threshold: number) => Promise<PublicRouteStage>;
  onValidate: (submission: ProductionPlayerSubmission) => Promise<{ correct: boolean }>;
}) {
  const [threshold, setThreshold] = useState(0);
  const [route, setRoute] = useState<PublicRouteStage>();
  const [cards, setCards] = useState<PublicRouteStage["cards"]>([]);
  const [status, setStatus] = useState("");
  const derivedRows = useMemo(() => artifact.luminanceRows.map((row) => row.map((value) => value < threshold ? "#" : ".").join("")), [artifact.luminanceRows, threshold]);
  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= cards.length) return;
    setCards((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination]!, next[index]!];
      return next;
    });
    setStatus("");
  };
  const keyMove = (event: KeyboardEvent<HTMLLIElement>, index: number) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); move(index, -1); }
    if (event.key === "ArrowRight") { event.preventDefault(); move(index, 1); }
  };
  const continueRoute = async () => {
    setStatus("");
    try {
      const next = await onResolveRoute(threshold);
      setRoute(next);
      setCards(next.cards);
    } catch (error) {
      setRoute(undefined);
      setCards([]);
      setStatus(error instanceof Error ? error.message : "The recovered mark is not complete yet.");
    }
  };
  const submit = async () => {
    const result = await onValidate({ kind: "ordered-symbols", symbols: cards.map((card) => card.symbol), threshold });
    setStatus(result.correct ? "Ordered symbols accepted. The passage is complete." : "That card order does not complete the passage.");
  };

  return <div className="stack">
    {accessibleMode
      ? <div className="puzzle-equivalent"><table aria-label="Source tone table" className="puzzle-luminance-table"><caption>Source tones, from 0 darkest to 255 lightest</caption><tbody>{artifact.luminanceRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}, tone ${value}`} key={columnIndex}>{value}</td>)}</tr>)}</tbody></table><pre aria-label="Current light and dark reduction">{derivedRows.join("\n")}</pre></div>
      : <><div aria-label="Microtext page" className="puzzle-qr-source" role="img">{artifact.luminanceRows.flatMap((row, rowIndex) => row.map((value, columnIndex) => <span key={`${rowIndex}:${columnIndex}`} style={{ backgroundColor: `rgb(${value} ${value} ${value})`, color: value < 128 ? "#d8d0bf" : "#27313b" }}>ei</span>))}</div><div aria-label="Light and dark preview" className="puzzle-qr-derived" role="img">{derivedRows.flatMap((row, rowIndex) => [...row].map((value, columnIndex) => <span className={value === "#" ? "is-dark" : ""} key={`${rowIndex}:${columnIndex}`} />))}</div></>}
    <label className="field">Light–dark separation<input aria-label="Light-dark separation" max={255} min={0} onChange={(event) => { setThreshold(Number(event.target.value)); setRoute(undefined); setCards([]); setStatus(""); }} type="range" value={threshold} /><output>{threshold}</output></label>
    <button className="button button--gold" onClick={() => void continueRoute()} type="button">Enter the recovered passage</button>
    {route && <section className="puzzle-card-stage"><h3>Cards beyond the passage</h3><p>{route.instructions}</p><ol aria-label="Symbol cards" className="puzzle-symbol-cards">{cards.map((card, index) => <li key={card.cardId} onKeyDown={(event) => keyMove(event, index)} tabIndex={0}><span aria-label={`${card.notchCount} notches`} className="puzzle-card-notches">{"•".repeat(card.notchCount)}</span><strong>{card.symbol}</strong><span><button aria-label={`Move ${card.symbol} left`} className="button" disabled={index === 0} onClick={() => move(index, -1)} type="button">←</button><button aria-label={`Move ${card.symbol} right`} className="button" disabled={index === cards.length - 1} onClick={() => move(index, 1)} type="button">→</button></span></li>)}</ol><button className="button button--gold" onClick={() => void submit()} type="button">Try this order</button></section>}
    {status && <p className={`notice ${status.startsWith("Ordered symbols accepted") ? "notice--good" : "notice--bad"}`} role="status">{status}</p>}
  </div>;
});
