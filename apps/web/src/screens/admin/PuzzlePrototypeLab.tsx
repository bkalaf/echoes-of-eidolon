import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { PublicPuzzlePrototype, PuzzlePrototypeKind } from "../../domain/puzzle-prototype-catalog";
import type { ProductionQaSandbox } from "../../server/puzzle-production-validation";
import { ProductionPuzzleQaSandbox } from "./ProductionPuzzleQaSandbox";

interface RuntimePuzzlePrototype extends PublicPuzzlePrototype {
  challenge: { instanceId: string; instructions: string; clues: string[] };
}

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? fallback);
  return result;
}

async function loadPrototypes() {
  return responseJson<{ productionSandboxes: ProductionQaSandbox[]; prototypes: RuntimePuzzlePrototype[]; total: number; timerStarted: false }>(
    await fetch("/api/admin/puzzles/preview"),
    "Puzzle QA catalog could not be loaded.",
  );
}

const surfaceNames: Record<PuzzlePrototypeKind, string> = {
  TEXT_COMPARE: "Document comparison surface",
  DATA_TRANSFORM: "Data transformation surface",
  VISUAL_LAYER: "Color-independent visual layer surface",
  SPATIAL_BOARD: "Keyboard-operable spatial board",
  AUDIO_SEQUENCE: "Captioned audio sequence",
  CONSTRAINT_GRID: "Constraint matrix",
  SOURCE_CHAIN: "Claim and source chain",
  MECHANISM_BOARD: "Discrete mechanism board",
  CROSS_MODAL: "Equivalent cross-modal surface",
};

function playCaptionedSequence(cues: readonly string[]) {
  const context = new window.AudioContext();
  const count = Math.min(cues.length, 8);
  for (let index = 0; index < count; index += 1) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 220 + ((cues[index]?.charCodeAt(0) ?? 0) % 12) * 24;
    gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + index * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.18 + 0.14);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime + index * 0.18);
    oscillator.stop(context.currentTime + index * 0.18 + 0.15);
  }
  window.setTimeout(() => void context.close(), Math.ceil(count * 180 + 250));
}

function PrototypeSurface({ prototype }: { prototype: RuntimePuzzlePrototype }) {
  const [marks, setMarks] = useState<Record<string, number>>({});
  const cycle = (cue: string) => setMarks((current) => ({ ...current, [cue]: ((current[cue] ?? 0) + 1) % 3 }));
  const cells = prototype.challenge.clues.map((cue, index) => <button aria-pressed={(marks[`${cue}-${index}`] ?? 0) > 0} className="button" key={`${cue}-${index}`} onClick={() => cycle(`${cue}-${index}`)} type="button">{cue} · {["open", "marked", "excluded"][marks[`${cue}-${index}`] ?? 0]}</button>);
  const grid = <div aria-label={surfaceNames[prototype.prototypeKind]} className="action-row" role="group">{cells}</div>;
  if (prototype.prototypeKind === "TEXT_COMPARE") {
    const midpoint = Math.max(1, Math.ceil(prototype.challenge.clues.length / 2));
    return <div className="form-grid"><article className="inset-card"><h4>Record A</h4><p>{prototype.challenge.clues.slice(0, midpoint).join(" · ")}</p></article><article className="inset-card"><h4>Record B</h4><p>{prototype.challenge.clues.slice(midpoint).reverse().join(" · ")}</p></article>{grid}</div>;
  }
  if (prototype.prototypeKind === "AUDIO_SEQUENCE" || prototype.prototypeKind === "CROSS_MODAL") return <div className="stack"><div className="action-row"><button className="button" onClick={() => playCaptionedSequence(prototype.challenge.clues)} type="button">Play sequence</button><span className="muted">Caption: {prototype.challenge.clues.join(" → ")}</span></div>{grid}</div>;
  if (prototype.prototypeKind === "SOURCE_CHAIN") return <div className="stack"><p className="muted">{prototype.sources.length} authored source record(s) accompany this sample. Order the claim tokens before submitting.</p>{grid}</div>;
  if (prototype.prototypeKind === "MECHANISM_BOARD") return <div className="stack"><p className="muted">Cycle each discrete mechanism state. Continuous physics is deliberately excluded from this prototype.</p>{grid}</div>;
  return grid;
}

function PrototypeOnlySandbox({ prototype }: { prototype: RuntimePuzzlePrototype }) {
  const [answer, setAnswer] = useState("");
  const [hintLevel, setHintLevel] = useState(0);
  const [result, setResult] = useState("");
  const validate = async () => {
    try {
      const response = await responseJson<{ correct: boolean }>(await fetch("/api/admin/puzzles/preview", {
        body: JSON.stringify({ answer, operation: "validate-prototype", puzzleBlueprintId: prototype.puzzleBlueprintId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }), "Prototype answer could not be validated.");
      setResult(response.correct ? "Sample prototype solved. Timer started: no." : "That answer does not satisfy the sample prototype.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Prototype answer could not be validated.");
    }
  };
  return <section className="card stack">
    <article className="inset-card"><div className="action-row action-row--between"><h2>{prototype.title}</h2><span className="tag">PROTOTYPE_ONLY</span></div><p>{prototype.concept}</p><dl className="detail-list"><dt>Family</dt><dd>{prototype.primaryFamily}</dd><dt>Tier</dt><dd>{prototype.difficultyTier}</dd><dt>Player modalities</dt><dd>{prototype.playerFacingModalities.join(" · ")}</dd><dt>Accessibility declarations</dt><dd>{prototype.accessibilityModalities.join(" · ")}</dd><dt>Answer format</dt><dd>{prototype.answerFormat}</dd></dl></article>
    <p className="notice notice--warn">This Blueprint remains a prototype sample. It is not represented as a canonical production player experience.</p>
    <p className="notice"><strong>Sample {prototype.challenge.instanceId}</strong><br />{prototype.challenge.instructions}</p>
    <PrototypeSurface key={prototype.puzzleBlueprintId} prototype={prototype} />
    <div className="action-row"><button className="button" disabled={hintLevel >= 1} onClick={() => setHintLevel(1)} type="button">Reveal Bobalus hint 1</button><button className="button" disabled={hintLevel < 1 || hintLevel >= 2} onClick={() => setHintLevel(2)} type="button">Reveal Bobalus hint 2</button><button className="button" onClick={() => { setAnswer(""); setHintLevel(0); setResult(""); }} type="button">Reset sample</button></div>
    {prototype.hints.slice(0, hintLevel).map((hint) => <p className="notice" key={hint.level}><strong>Hint {hint.level} · {hint.kind}</strong><br />{hint.text}</p>)}
    <label className="field">Sample answer<input className="input" onChange={(event) => setAnswer(event.target.value)} placeholder={prototype.answerFormat} value={answer} /></label>
    <button className="button button--gold" disabled={!answer.trim()} onClick={() => void validate()} type="button">Validate sample answer</button>
    {result && <p className={`notice ${result.startsWith("Sample prototype solved") ? "notice--good" : "notice--bad"}`} role="status">{result}</p>}
  </section>;
}

export function PuzzlePrototypeLab({ fixedBlueprintId }: { fixedBlueprintId?: string }) {
  const prototypes = useQuery({ queryFn: loadPrototypes, queryKey: ["admin", "puzzles", "prototypes"], retry: false });
  const [selectedId, setSelectedId] = useState(fixedBlueprintId ?? "");
  if (prototypes.isPending) return <p className="notice">Loading Puzzle QA surfaces…</p>;
  if (prototypes.isError) return <p className="notice notice--bad" role="alert">{prototypes.error.message}</p>;
  const productionSandboxes = prototypes.data.productionSandboxes ?? [];
  const prototypeEntries = prototypes.data.prototypes ?? [];
  const requestedId = fixedBlueprintId ?? selectedId;
  const production = productionSandboxes.find((sandbox) => sandbox.ownerQa.puzzleBlueprintId === requestedId)
    ?? (!fixedBlueprintId && !requestedId ? productionSandboxes[0] : undefined);
  const selected = prototypeEntries.find((entry) => entry.puzzleBlueprintId === requestedId)
    ?? (!fixedBlueprintId && !requestedId && !production ? prototypeEntries[0] : undefined);
  const activeId = production?.ownerQa.puzzleBlueprintId ?? selected?.puzzleBlueprintId ?? requestedId;
  const options = [
    ...productionSandboxes.map((sandbox) => ({ puzzleBlueprintId: sandbox.ownerQa.puzzleBlueprintId, status: "PRODUCTION", title: sandbox.ownerQa.title })),
    ...prototypeEntries.map((prototype) => ({ puzzleBlueprintId: prototype.puzzleBlueprintId, status: "PROTOTYPE_ONLY", title: prototype.title })),
  ].sort((left, right) => left.puzzleBlueprintId.localeCompare(right.puzzleBlueprintId));
  return <section className="stack">
    <section className="card"><div className="action-row action-row--between"><div><h2>Witness Puzzle Box · Owner QA</h2><p>The four production Blueprints mount their canonical player renderers. The other 66 remain explicitly prototype-only.</p></div><span className="tag">4 production · 66 prototype</span></div>{fixedBlueprintId ? <p><strong>Blueprint:</strong> {activeId}</p> : <label className="field">Puzzle Blueprint<select className="input" onChange={(event) => setSelectedId(event.target.value)} value={activeId}>{options.map((entry) => <option key={entry.puzzleBlueprintId} value={entry.puzzleBlueprintId}>{entry.puzzleBlueprintId} · {entry.title} · {entry.status}</option>)}</select></label>}</section>
    {production ? <ProductionPuzzleQaSandbox initialSandbox={production} key={production.ownerQa.puzzleBlueprintId} /> : selected ? <PrototypeOnlySandbox prototype={selected} /> : <p className="notice notice--bad">No imported Blueprint exists for {activeId}.</p>}
  </section>;
}
