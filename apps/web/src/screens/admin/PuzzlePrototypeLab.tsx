import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { PublicPuzzlePrototype, PuzzlePrototypeKind } from "../../domain/puzzle-prototype-catalog";

interface RuntimePuzzlePrototype extends PublicPuzzlePrototype {
  challenge: {
    instanceId: string;
    instructions: string;
    clues: string[];
  };
}

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? fallback);
  return result;
}

async function loadPrototypes() {
  return responseJson<{ prototypes: RuntimePuzzlePrototype[]; total: number; timerStarted: false }>(
    await fetch("/api/admin/puzzles/preview"),
    "Puzzle prototypes could not be loaded.",
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
  const AudioContextConstructor = window.AudioContext;
  const context = new AudioContextConstructor();
  const count = Math.min(cues.length, 8);
  for (let index = 0; index < count; index += 1) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 220 + ((cues[index]?.charCodeAt(0) ?? 0) % 12) * 24;
    gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + index * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.18 + 0.14);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + index * 0.18);
    oscillator.stop(context.currentTime + index * 0.18 + 0.15);
  }
  window.setTimeout(() => void context.close(), Math.ceil(count * 180 + 250));
}

function PrototypeSurface({ prototype }: { prototype: RuntimePuzzlePrototype }) {
  const [marks, setMarks] = useState<Record<string, number>>({});
  const cycle = (cue: string) => setMarks((current) => ({ ...current, [cue]: ((current[cue] ?? 0) + 1) % 3 }));
  const cells = prototype.challenge.clues.map((cue, index) => (
    <button
      className="button"
      key={`${cue}-${index}`}
      onClick={() => cycle(`${cue}-${index}`)}
      aria-pressed={(marks[`${cue}-${index}`] ?? 0) > 0}
    >
      {cue} · {["open", "marked", "excluded"][marks[`${cue}-${index}`] ?? 0]}
    </button>
  ));
  const grid = <div className="action-row" role="group" aria-label={surfaceNames[prototype.prototypeKind]}>{cells}</div>;

  if (prototype.prototypeKind === "TEXT_COMPARE") {
    const midpoint = Math.max(1, Math.ceil(prototype.challenge.clues.length / 2));
    return <div className="form-grid"><article className="inset-card"><h4>Record A</h4><p>{prototype.challenge.clues.slice(0, midpoint).join(" · ")}</p></article><article className="inset-card"><h4>Record B</h4><p>{prototype.challenge.clues.slice(midpoint).reverse().join(" · ")}</p></article>{grid}</div>;
  }
  if (prototype.prototypeKind === "AUDIO_SEQUENCE" || prototype.prototypeKind === "CROSS_MODAL") {
    return <div className="stack"><div className="action-row"><button className="button" onClick={() => playCaptionedSequence(prototype.challenge.clues)}>Play sequence</button><span className="muted">Caption: {prototype.challenge.clues.join(" → ")}</span></div>{grid}</div>;
  }
  if (prototype.prototypeKind === "SOURCE_CHAIN") {
    return <div className="stack"><p className="muted">{prototype.sources.length} authored source record(s) accompany this sample. Order the claim tokens before submitting.</p>{grid}</div>;
  }
  if (prototype.prototypeKind === "MECHANISM_BOARD") {
    return <div className="stack"><p className="muted">Cycle each discrete mechanism state. Continuous physics is deliberately excluded from this prototype.</p>{grid}</div>;
  }
  return grid;
}

export function PuzzlePrototypeLab({ fixedBlueprintId }: { fixedBlueprintId?: string }) {
  const prototypes = useQuery({ queryKey: ["admin", "puzzles", "prototypes"], queryFn: loadPrototypes, retry: false });
  const [selectedId, setSelectedId] = useState(fixedBlueprintId ?? "");
  const [answer, setAnswer] = useState("");
  const [hintLevel, setHintLevel] = useState(0);
  const [result, setResult] = useState("");
  if (prototypes.isPending) return <p className="notice">Loading 70 Puzzle prototypes…</p>;
  if (prototypes.isError) return <p className="notice notice--bad" role="alert">{prototypes.error.message}</p>;
  const requestedId = fixedBlueprintId ?? selectedId;
  const selected = prototypes.data.prototypes.find((entry) => entry.puzzleBlueprintId === requestedId)
    ?? (!fixedBlueprintId ? prototypes.data.prototypes[0] : undefined);
  const activeId = selected?.puzzleBlueprintId ?? selectedId;
  const choose = (value: string) => {
    setSelectedId(value);
    setAnswer("");
    setHintLevel(0);
    setResult("");
  };
  const validate = async () => {
    if (!selected) return;
    try {
      const response = await responseJson<{ correct: boolean; puzzleBlueprintId: string; timerStarted: false }>(
        await fetch("/api/admin/puzzles/preview", {
          body: JSON.stringify({ operation: "validate-prototype", puzzleBlueprintId: selected.puzzleBlueprintId, answer }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
        "Prototype answer could not be validated.",
      );
      setResult(response.correct ? "Sample prototype solved. Timer started: no." : "That sample answer does not satisfy the prototype.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Prototype answer could not be validated.");
    }
  };

  return <section className="card stack">
    <div className="action-row action-row--between">
      <div><h2>Witness Puzzle Box · 70 Prototype Lab</h2><p>Interactive sample vertical slices for every approved Blueprint. These samples do not create assignments or start the 25-day live timer.</p></div>
      <span className="tag">{prototypes.data.total} prototypes</span>
    </div>
    {fixedBlueprintId
      ? <p><strong>Blueprint:</strong> {activeId}</p>
      : <label className="field">Prototype
          <select className="input" value={activeId} onChange={(event) => choose(event.target.value)}>
            {prototypes.data.prototypes.map((entry) => <option key={entry.puzzleBlueprintId} value={entry.puzzleBlueprintId}>{entry.puzzleBlueprintId} · {entry.title}</option>)}
          </select>
        </label>}
    {!selected
      ? <p className="notice notice--bad">No imported prototype exists for {activeId}.</p>
      : <>
          <article className="inset-card">
            <div className="action-row action-row--between"><h3>{selected.title}</h3><span className="tag">{surfaceNames[selected.prototypeKind]}</span></div>
            <p>{selected.concept}</p>
            <dl className="detail-list"><dt>Family</dt><dd>{selected.primaryFamily}</dd><dt>Tier</dt><dd>{selected.difficultyTier}</dd><dt>Answer format</dt><dd>{selected.answerFormat}</dd><dt>Expected time</dt><dd>{selected.estimatedSolveTime}</dd></dl>
          </article>
          <p className="notice"><strong>Sample {selected.challenge.instanceId}</strong><br />{selected.challenge.instructions}</p>
          <PrototypeSurface key={selected.puzzleBlueprintId} prototype={selected} />
          <div className="action-row">
            <button className="button" disabled={hintLevel >= 1} onClick={() => setHintLevel(1)}>Reveal Bobalus hint 1</button>
            <button className="button" disabled={hintLevel < 1 || hintLevel >= 2} onClick={() => setHintLevel(2)}>Reveal Bobalus hint 2</button>
            <button className="button" onClick={() => { setAnswer(""); setHintLevel(0); setResult(""); }}>Reset sample</button>
          </div>
          {selected.hints.slice(0, hintLevel).map((hint) => <p className="notice" key={hint.level}><strong>Hint {hint.level} · {hint.kind}</strong><br />{hint.text}</p>)}
          <label className="field">Sample answer
            <input className="input" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={selected.answerFormat} />
          </label>
          <div className="action-row">
            <button className="button button--gold" disabled={!answer.trim()} onClick={() => void validate()}>Validate sample answer</button>
            {selected.decoys.slice(0, 3).map((decoy) => <button className="button" key={decoy} onClick={() => setAnswer(decoy)}>Try decoy {decoy}</button>)}
          </div>
          {result && <p className={`notice ${result.startsWith("Sample prototype solved") ? "notice--good" : "notice--bad"}`} role="status">{result}</p>}
        </>}
  </section>;
}
