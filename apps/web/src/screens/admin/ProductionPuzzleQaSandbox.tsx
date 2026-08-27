import { useState } from "react";

import { PlayerPuzzleSurface } from "../../components/puzzles/PlayerPuzzleSurface";
import type { ProductionPlayerSubmission, ProductionQaSandbox, PublicRouteStage } from "../../server/puzzle-production-validation";

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? fallback);
  return result;
}

function submissionLabel(submission: ProductionPlayerSubmission) {
  if (submission.kind === "bitmap-code") return `${submission.value} · ${submission.markedCoordinates.length} marked cells`;
  if (submission.kind === "coordinate") return `row ${submission.row}, column ${submission.column}`;
  if (submission.kind === "set") return `{ ${submission.members.join(", ")} }`;
  if (submission.kind === "hex") return submission.value;
  return submission.symbols.join("");
}

export function ProductionPuzzleQaSandbox({ initialSandbox }: { initialSandbox: ProductionQaSandbox }) {
  const [sandbox, setSandbox] = useState(initialSandbox);
  const [resetToken, setResetToken] = useState(0);
  const [reveal, setReveal] = useState<{ expectedSolution: string; intendedSolvePath: string[] }>();
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Array<{ correct: boolean; instanceIdentity: string; submission: string }>>([]);
  const { ownerQa, playerPuzzle } = sandbox;

  const validate = async (submission: ProductionPlayerSubmission) => {
    const result = await responseJson<{ correct: boolean }>(await fetch("/api/admin/puzzles/preview", {
      body: JSON.stringify({ generation: sandbox.generation, operation: "validate-production-player", puzzleBlueprintId: ownerQa.puzzleBlueprintId, submission }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }), "The player submission could not be validated.");
    setHistory((current) => [{ correct: result.correct, instanceIdentity: ownerQa.instanceIdentity, submission: submissionLabel(submission) }, ...current]);
    return result;
  };
  const resolveRoute = async (threshold: number): Promise<PublicRouteStage> => responseJson(await fetch("/api/admin/puzzles/preview", {
    body: JSON.stringify({ generation: sandbox.generation, operation: "resolve-production-route", puzzleBlueprintId: "PZB-021", threshold }),
    headers: { "content-type": "application/json" },
    method: "POST",
  }), "The recovered passage could not be opened.");
  const regenerate = async () => {
    setMessage("");
    try {
      const nextGeneration = sandbox.generation + 1;
      const next = await responseJson<ProductionQaSandbox>(await fetch("/api/admin/puzzles/preview", {
        body: JSON.stringify({ generation: nextGeneration, operation: "regenerate-production", puzzleBlueprintId: ownerQa.puzzleBlueprintId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }), "The sandbox instance could not be regenerated.");
      setSandbox(next);
      setReveal(undefined);
      setResetToken((value) => value + 1);
      setMessage("A new deterministic sandbox instance is ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The sandbox instance could not be regenerated.");
    }
  };
  const revealSolution = async () => {
    setMessage("");
    try {
      const result = await responseJson<{ expectedSolution: string; intendedSolvePath: string[] }>(await fetch("/api/admin/puzzles/solution", {
        body: JSON.stringify({ generation: sandbox.generation, puzzleBlueprintId: ownerQa.puzzleBlueprintId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }), "The expected solution could not be revealed.");
      setReveal(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The expected solution could not be revealed.");
    }
  };

  return <div className="production-puzzle-qa">
    <aside aria-label="Owner puzzle QA panel" className="production-puzzle-qa__panel stack">
      <div className="action-row action-row--between"><div><p className="muted">Owner QA</p><h2>{ownerQa.puzzleBlueprintId} · {ownerQa.publicTitle}</h2><p className="muted">Internal source title: {ownerQa.title}</p></div><span className="tag">PRODUCTION</span></div>
      <dl className="detail-list"><dt>Difficulty tier</dt><dd>{ownerQa.difficultyTier}</dd><dt>Family</dt><dd>{ownerQa.family}</dd><dt>Generator version</dt><dd>{ownerQa.generatorVersion}</dd><dt>Expected answer format</dt><dd>{ownerQa.expectedAnswerFormat}</dd><dt>Current instance</dt><dd>{ownerQa.instanceIdentity}</dd><dt>Accessibility modes</dt><dd>{ownerQa.accessibilityModes.join(" · ")}</dd></dl>
      <section><h3>Authored concept</h3><p>{ownerQa.authoredConcept}</p></section>
      <section><h3>Intended solve path</h3><ol>{ownerQa.intendedSolvePath.map((step) => <li key={step}>{step}</li>)}</ol></section>
      <section><h3>Authored hints</h3>{ownerQa.hints.map((hint) => <p key={hint.level}><strong>Hint {hint.level}</strong><br />{hint.text}</p>)}</section>
      <div className="action-row"><button className="button" onClick={() => { setResetToken((value) => value + 1); setReveal(undefined); setMessage("Player progress reset."); }} type="button">Reset player surface</button><button className="button" onClick={() => void regenerate()} type="button">Regenerate instance</button><button className="button button--gold" onClick={() => void revealSolution()} type="button">Reveal expected solution</button></div>
      {reveal && <section aria-label="Privileged expected solution" className="notice notice--warn"><h3>Expected solution</h3><p className="production-puzzle-qa__solution">{reveal.expectedSolution}</p><p>This answer was fetched separately through the authorized owner route. It is not present in the player payload.</p></section>}
      {message && <p className="notice" role="status">{message}</p>}
      <section><h3>Validation history</h3>{history.length ? <ol className="production-puzzle-qa__history">{history.map((entry, index) => <li key={`${entry.instanceIdentity}:${index}`}><strong>{entry.correct ? "Correct" : "Incorrect"}</strong> · {entry.submission} <span className="muted">({entry.instanceIdentity})</span></li>)}</ol> : <p>No submissions for this QA session.</p>}</section>
    </aside>
    <PlayerPuzzleSurface onResolveRoute={ownerQa.puzzleBlueprintId === "PZB-021" ? resolveRoute : undefined} onValidate={validate} puzzle={playerPuzzle} resetToken={resetToken} />
  </div>;
}
