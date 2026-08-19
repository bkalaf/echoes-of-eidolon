import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { PublicPuzzlePrototype, PuzzlePrototypeKind } from "../../domain/puzzle-prototype-catalog";
import type { GenericProductionCarrier, ProductionCarrier, PublicProductionPuzzle } from "../../server/puzzle-production-generators";
import type { PublicTutorialPuzzle, TutorialCarrier } from "../../server/puzzle-tutorial-generators";

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
  return responseJson<{ productionPuzzles?: PublicProductionPuzzle[]; productionTutorials?: PublicTutorialPuzzle[]; prototypes: RuntimePuzzlePrototype[]; total: number; timerStarted: false }>(
    await fetch("/api/admin/puzzles/preview"),
    "Puzzle prototypes could not be loaded.",
  );
}

function GenericProductionSurface({ production }: { production: PublicProductionPuzzle }) {
  const carrier = production.carrier as GenericProductionCarrier;
  let surface;
  if (carrier.kind === "TEXT_DOCUMENT_PAIR") {
    surface = <ol aria-label="Text document pair carrier"><li>Document A: {carrier.documentA.map((clue) => `${clue.ordinal + 1}:${clue.encodedValue}`).join(" · ")}</li><li>Document B: {carrier.documentB.map((clue) => `${clue.ordinal + 1}:${clue.encodedValue}`).join(" · ")}</li></ol>;
  } else if (carrier.kind === "NUMERIC_LEDGER") {
    surface = <table aria-label="Numeric ledger carrier" className="data-table"><thead><tr><th>Ordinal</th><th>Encoded value</th></tr></thead><tbody>{carrier.cells.map((cell) => <tr key={cell.ordinal}><th>{cell.ordinal + 1}</th><td>{cell.encodedValue}</td></tr>)}</tbody></table>;
  } else if (carrier.kind === "VISUAL_SHAPE_LAYERS") {
    surface = <ol aria-label="Color-independent shape layer carrier">{carrier.layers.map((layer) => <li key={layer.ordinal}>Layer {layer.ordinal + 1}: {layer.shape}, {layer.texture}, value {layer.encodedValue}</li>)}</ol>;
  } else if (carrier.kind === "SPATIAL_ROUTE_BOARD") {
    surface = <div aria-label="Keyboard-operable spatial route carrier" className="action-row" role="group">{carrier.tiles.map((tile) => <button className="button" key={tile.ordinal} type="button">{tile.keyboardLabel}: {tile.encodedValue}</button>)}</div>;
  } else if (carrier.kind === "AUDIO_CAPTION_SEQUENCE") {
    surface = <ol aria-label="Captioned audio sequence carrier">{carrier.events.map((event) => <li key={event.ordinal}>{event.caption}; note label {event.note}</li>)}</ol>;
  } else if (carrier.kind === "LOGIC_CONSTRAINT_GRID") {
    surface = <table aria-label="Logic constraint carrier" className="data-table"><thead><tr><th>Constraint</th><th>Encoded value</th></tr></thead><tbody>{carrier.constraints.map((constraint) => <tr key={constraint.ordinal}><th>{constraint.relation}</th><td>{constraint.encodedValue}</td></tr>)}</tbody></table>;
  } else if (carrier.kind === "RESEARCH_CLAIM_CHAIN") {
    surface = <ol aria-label="Research claim and citation carrier">{carrier.claims.map((claim) => <li key={claim.ordinal}>{claim.claimLabel}: {claim.encodedValue} · <a href={claim.citation} rel="noreferrer" target="_blank">Declared source</a></li>)}</ol>;
  } else if (carrier.kind === "MECHANISM_REGISTER_BOARD") {
    surface = <div aria-label="Discrete mechanism register carrier" className="action-row" role="group">{carrier.registers.map((register) => <button className="button" key={register.ordinal} type="button">{register.control}: {register.encodedValue}</button>)}</div>;
  } else {
    surface = <ol aria-label="Equivalent cross-modal signal carrier">{carrier.pairs.map((pair) => <li key={pair.ordinal}>{pair.audioCaption} · visual {pair.visualCue} · value {pair.encodedValue}</li>)}</ol>;
  }
  return <section className="inset-card stack"><h3>Production generator {production.generatorVersion}</h3><p><strong>{production.familyKind}</strong></p><p>{carrier.instructions}</p>{production.playerFacingModalities && <p><strong>Player modalities</strong><br />{production.playerFacingModalities.join(" · ")}</p>}<p><strong>Accessibility equivalents</strong><br />{production.accessibilityModes.join(" · ")}</p>{surface}<p className="muted">Checksum: {production.instanceChecksum}</p><p>Runtime records: {production.liveRuntimeRecordsCreated} · Timer started: {production.timerStarted ? "yes" : "no"}</p></section>;
}

interface TutorialSurfacePuzzle {
  accessibilityModes: string[];
  carrier: TutorialCarrier;
  generatorVersion: string;
  instanceChecksum: string;
  liveRuntimeRecordsCreated: 0;
  timerStarted: false;
}

function isTutorialCarrier(carrier: ProductionCarrier): carrier is TutorialCarrier {
  return ["ORDINAL_CANCELLATION_MATRIX", "SET_AMBIGRAM", "MUSICAL_HEX_GRID", "TYPOGRAPHIC_QR_THRESHOLD"].includes(carrier.kind);
}

function TutorialProductionSurface({ tutorial }: { tutorial: TutorialSurfacePuzzle }) {
  const carrier = tutorial.carrier;
  const [routeStage, setRouteStage] = useState<{ instructions: string; symbolCards: Array<{ ordinal: number; symbol: string }> }>();
  const [routeError, setRouteError] = useState("");
  const resolveRoute = async (routeToken: string) => {
    setRouteError("");
    try {
      const result = await responseJson<{ instructions: string; symbolCards: Array<{ ordinal: number; symbol: string }> }>(await fetch("/api/admin/puzzles/preview", {
        body: JSON.stringify({ operation: "resolve-tutorial-route", puzzleBlueprintId: "PZB-021", routeToken }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }), "The signed tutorial route could not be resolved.");
      setRouteStage(result);
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : "The signed tutorial route could not be resolved.");
    }
  };
  let surface;
  if (carrier.kind === "ORDINAL_CANCELLATION_MATRIX") {
    surface = <table aria-label="Ordinal cancellation matrices" className="data-table"><thead><tr><th>Coordinate</th><th>Matrix A</th><th>Matrix B</th><th>Sum</th></tr></thead><tbody>{carrier.matrixA.flatMap((row, rowIndex) => row.map((value, columnIndex) => <tr key={`${rowIndex}:${columnIndex}`}><th>{rowIndex + 1},{columnIndex + 1}</th><td>{value}</td><td>{carrier.matrixB[rowIndex]![columnIndex]}</td><td>{value + carrier.matrixB[rowIndex]![columnIndex]!}</td></tr>))}</tbody></table>;
  } else if (carrier.kind === "SET_AMBIGRAM") {
    surface = <div className="grid-2"><dl className="detail-list">{Object.entries(carrier.sets).map(([name, values]) => <div key={name}><dt>Set {name}</dt><dd>{values.join(", ")}</dd></div>)}</dl><ol>{carrier.expressions.map((expression) => <li key={expression}>{expression}</li>)}</ol><p>Result checksum: {carrier.resultChecksum}</p></div>;
  } else if (carrier.kind === "MUSICAL_HEX_GRID") {
    surface = <div className="stack"><p><strong>Captioned note events</strong></p><p>{carrier.noteEvents.join(" ")}</p><details><summary>Texture-grid equivalent</summary><ol>{carrier.textureGrid.map((cell) => <li key={cell}>{cell}</li>)}</ol></details></div>;
  } else {
    surface = <div className="stack"><p>Threshold: {carrier.threshold}</p><pre aria-label="Module matrix table">{carrier.moduleMatrixTable.join("\n")}</pre><button className="button" onClick={() => void resolveRoute(carrier.routeAction.opaqueToken)} type="button">Resolve signed route</button>{routeStage && <div className="notice" role="status"><p>{routeStage.instructions}</p><ol>{routeStage.symbolCards.map((card) => <li key={card.ordinal}>Card {card.ordinal + 1}: {card.symbol}</li>)}</ol></div>}{routeError && <p className="notice notice--bad" role="alert">{routeError}</p>}</div>;
  }
  return <section className="inset-card stack"><h3>Production tutorial generator {tutorial.generatorVersion}</h3><p>{carrier.instructions}</p><p><strong>Accessibility equivalents</strong><br />{tutorial.accessibilityModes.join(" · ")}</p>{surface}<p className="muted">Checksum: {tutorial.instanceChecksum}</p><p>Runtime records: {tutorial.liveRuntimeRecordsCreated} · Timer started: {tutorial.timerStarted ? "yes" : "no"}</p></section>;
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
  const productionPuzzle = prototypes.data.productionPuzzles?.find((entry) => entry.puzzleBlueprintId === selected?.puzzleBlueprintId);
  const productionPuzzleIsTutorial = productionPuzzle ? isTutorialCarrier(productionPuzzle.carrier) : false;
  const productionTutorial = prototypes.data.productionTutorials?.find((entry) => entry.puzzleBlueprintId === selected?.puzzleBlueprintId);
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
          body: JSON.stringify({ operation: productionPuzzle ? "validate-production" : productionTutorial ? "validate-tutorial" : "validate-prototype", puzzleBlueprintId: selected.puzzleBlueprintId, answer }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
        "Prototype answer could not be validated.",
      );
      const validationLabel = productionPuzzleIsTutorial || productionTutorial ? "Production tutorial" : productionPuzzle ? "Production generator" : "Sample prototype";
      setResult(response.correct ? `${validationLabel} solved. Timer started: no.` : `That answer does not satisfy the ${validationLabel.toLowerCase()}.`);
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
            <dl className="detail-list"><dt>Family</dt><dd>{selected.primaryFamily}</dd><dt>Tier</dt><dd>{selected.difficultyTier}</dd><dt>Player modalities</dt><dd>{selected.playerFacingModalities.join(" · ")}</dd><dt>Accessibility modes</dt><dd>{selected.accessibilityModalities.join(" · ")}</dd><dt>Answer format</dt><dd>{selected.answerFormat}</dd><dt>Expected time</dt><dd>{selected.estimatedSolveTime}</dd></dl>
          </article>
          {productionPuzzle && productionPuzzleIsTutorial && <TutorialProductionSurface tutorial={{ ...productionPuzzle, carrier: productionPuzzle.carrier as TutorialCarrier }} />}
          {productionPuzzle && !productionPuzzleIsTutorial && <GenericProductionSurface production={productionPuzzle} />}
          {!productionPuzzle && productionTutorial && <TutorialProductionSurface tutorial={productionTutorial} />}
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
