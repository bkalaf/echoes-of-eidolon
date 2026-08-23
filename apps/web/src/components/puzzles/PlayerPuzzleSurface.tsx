import { useState } from "react";

import type { PublicProductionPuzzle } from "../../server/puzzle-production-generators";
import type { ProductionPlayerSubmission, PublicRouteStage } from "../../server/puzzle-production-validation";
import { MusicalHexPuzzle } from "./MusicalHexPuzzle";
import { OrdinalCancellationPuzzle } from "./OrdinalCancellationPuzzle";
import { SetAmbigramPuzzle } from "./SetAmbigramPuzzle";
import { TypographicQrPuzzle } from "./TypographicQrPuzzle";

export function PlayerPuzzleSurface({ onResolveRoute, onValidate, puzzle, resetToken = 0 }: {
  onResolveRoute?: (threshold: number) => Promise<PublicRouteStage>;
  onValidate: (submission: ProductionPlayerSubmission) => Promise<{ correct: boolean }>;
  puzzle: PublicProductionPuzzle;
  resetToken?: number;
}) {
  const [accessibleMode, setAccessibleMode] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [localReset, setLocalReset] = useState(0);
  const key = `${puzzle.instanceId}:${resetToken}:${localReset}`;
  let renderer;
  if (puzzle.carrier.kind === "ORDINAL_CANCELLATION_MATRIX") renderer = <OrdinalCancellationPuzzle accessibleMode={accessibleMode} carrier={puzzle.carrier} key={key} onValidate={onValidate} />;
  else if (puzzle.carrier.kind === "SET_AMBIGRAM") renderer = <SetAmbigramPuzzle accessibleMode={accessibleMode} carrier={puzzle.carrier} key={key} onValidate={onValidate} />;
  else if (puzzle.carrier.kind === "MUSICAL_HEX_GRID") renderer = <MusicalHexPuzzle accessibleMode={accessibleMode} carrier={puzzle.carrier} key={key} onValidate={onValidate} />;
  else if (puzzle.carrier.kind === "TYPOGRAPHIC_QR_THRESHOLD") renderer = <TypographicQrPuzzle accessibleMode={accessibleMode} carrier={puzzle.carrier} key={key} onResolveRoute={onResolveRoute ?? (async () => { throw new Error("The recovered passage is unavailable."); })} onValidate={onValidate} />;
  else throw new Error("A production Puzzle reached the player surface without its canonical renderer.");

  return <article aria-label={`${puzzle.title} player puzzle`} className="player-puzzle-surface">
    <header><p className="player-puzzle-surface__eyebrow">Witness Puzzle</p><h2>{puzzle.title}</h2></header>
    <div aria-label="Presentation mode" className="action-row" role="group"><button aria-pressed={!accessibleMode} className="button" onClick={() => setAccessibleMode(false)} type="button">Standard presentation</button><button aria-pressed={accessibleMode} className="button" onClick={() => setAccessibleMode(true)} type="button">Accessible equivalent</button></div>
    {renderer}
    <section aria-label="Puzzle hints" className="puzzle-hints"><div className="action-row"><button className="button" disabled={hintLevel >= 1} onClick={() => setHintLevel(1)} type="button">Hint 1</button><button className="button" disabled={hintLevel < 1 || hintLevel >= 2} onClick={() => setHintLevel(2)} type="button">Hint 2</button><button className="button" onClick={() => { setHintLevel(0); setAccessibleMode(false); setLocalReset((value) => value + 1); }} type="button">Reset puzzle</button></div>{puzzle.hints.slice(0, hintLevel).map((hint) => <p className="notice" key={hint.level}><strong>Hint {hint.level}</strong><br />{hint.text}</p>)}</section>
  </article>;
}
