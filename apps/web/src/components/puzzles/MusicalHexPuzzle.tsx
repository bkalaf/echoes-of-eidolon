import { memo, useEffect, useMemo, useRef, useState } from "react";

import type { MusicPlayerArtifact } from "../../server/puzzle-production-generators";
import type { ProductionPlayerSubmission } from "../../server/puzzle-production-validation";

const frequencies: Record<string, number> = { A: 220, B: 246.94, C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392 };
const noteSteps: Record<string, number> = { A: 5, B: 6, C: 0, D: 1, E: 2, F: 3, G: 4 };

function noteY(note: string, octave: number, staffBottom: number) {
  const stepFromE4 = (octave - 4) * 7 + (noteSteps[note] ?? 2) - 2;
  return staffBottom - stepFromE4 * 3.25;
}

const ScorePage = memo(function ScorePage({ activeMeasure, artifact, page }: { activeMeasure: number; artifact: MusicPlayerArtifact; page: number }) {
  const firstMeasure = page * 32;
  return <svg aria-label={`Glass Vespers score page ${page + 1} of 4`} className="puzzle-score-page" role="img" viewBox="0 0 620 390">
    <title>{`Glass Vespers score, page ${page + 1}. Four systems in six eight time, eight measures per system.`}</title>
    <rect fill="#f5f0df" height="390" rx="5" width="620" />
    <text className="puzzle-score-title" textAnchor="middle" x="310" y="20">Glass Vespers · {page + 1}</text>
    {Array.from({ length: 4 }, (_, system) => {
      const systemTop = 38 + system * 87;
      const staffBottom = systemTop + 34;
      const systemFirst = firstMeasure + system * 8;
      return <g key={system}>
        {Array.from({ length: 5 }, (_, line) => <line className="puzzle-score-staff" key={line} x1="42" x2="592" y1={systemTop + 8 + line * 6.5} y2={systemTop + 8 + line * 6.5} />)}
        <text className="puzzle-score-clef" x="45" y={systemTop + 33}>𝄞</text>
        <text className="puzzle-score-time" x="70" y={systemTop + 19}>6</text><text className="puzzle-score-time" x="70" y={systemTop + 32}>8</text>
        {Array.from({ length: 8 }, (_, measureOffset) => {
          const measure = systemFirst + measureOffset;
          const x = 87 + measureOffset * 63;
          const events = artifact.scoreEvents.filter((event) => event.measure === measure && !event.control);
          const beamY = Math.min(...events.map((event) => noteY(event.note, event.octave, staffBottom))) - 20;
          return <g aria-label={`Measure ${measure + 1}: ${events.map((event) => `${event.note}${event.octave}`).join(" ")}`} key={measure} role="group">
            {activeMeasure === measure && <rect className="puzzle-score-highlight" height="45" rx="3" width="62" x={x - 2} y={systemTop + 1} />}
            {events.map((event) => {
              const noteX = x + 4 + event.beat * 8.5;
              const y = noteY(event.note, event.octave, staffBottom);
              return <g key={event.beat}><ellipse className="puzzle-score-note" cx={noteX} cy={y} rx="3.8" ry="2.7" transform={`rotate(-18 ${noteX} ${y})`} /><line className="puzzle-score-stem" x1={noteX + 3} x2={noteX + 3} y1={y} y2={beamY} /></g>;
            })}
            {events.length === 6 && <line className="puzzle-score-beam" x1={x + 7} x2={x + 49} y1={beamY} y2={beamY} />}
            <line className="puzzle-score-bar" x1={x + 59} x2={x + 59} y1={systemTop + 8} y2={staffBottom} />
          </g>;
        })}
        <text aria-label={`G control after measure ${systemFirst + 8}`} className="puzzle-score-control" x="598" y={systemTop + 29}>G</text>
      </g>;
    })}
  </svg>;
});

function ColorField({ cells }: { cells: string[] }) {
  return <div aria-label="Developed 32 by 4 glass pane" className="puzzle-color-field" role="img">{cells.map((cell, index) => <span key={index} style={{ backgroundColor: `#${cell}` }} />)}</div>;
}

export const MusicalHexPuzzle = memo(function MusicalHexPuzzle({ accessibleMode, artifact, onValidate }: {
  accessibleMode: boolean;
  artifact: MusicPlayerArtifact;
  onValidate: (submission: ProductionPlayerSubmission) => Promise<{ correct: boolean }>;
}) {
  const contextRef = useRef<AudioContext | undefined>(undefined);
  const playbackTimer = useRef<number | undefined>(undefined);
  const eventIndex = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeMeasure, setActiveMeasure] = useState(-1);
  const [groupSize, setGroupSize] = useState(0);
  const [separator, setSeparator] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showTexture, setShowTexture] = useState(false);

  const colorCells = useMemo(() => Array.from({ length: 128 }, (_, measure) => artifact.scoreEvents.filter((event) => event.measure === measure && !event.control).map((event) => event.note).join("")), [artifact.scoreEvents]);
  const developed = groupSize === 6 && separator === "G";

  const clearTimer = () => {
    if (playbackTimer.current !== undefined) window.clearInterval(playbackTimer.current);
    playbackTimer.current = undefined;
  };
  const stop = () => {
    clearTimer();
    if (contextRef.current) void contextRef.current.close();
    contextRef.current = undefined;
    eventIndex.current = 0;
    setPlaying(false);
    setPaused(false);
    setProgress(0);
    setActiveMeasure(-1);
  };
  useEffect(() => () => {
    clearTimer();
    if (contextRef.current) void contextRef.current.close();
  }, []);

  const soundEvent = (context: AudioContext, event: MusicPlayerArtifact["scoreEvents"][number]) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = event.control ? "triangle" : "sine";
    oscillator.frequency.value = (frequencies[event.note] ?? 220) * 2 ** (event.octave - 4);
    const startsAt = context.currentTime;
    const endsAt = startsAt + (event.control ? 0.09 : 0.075);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(event.control ? 0.035 : 0.065, startsAt + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startsAt);
    oscillator.stop(endsAt);
  };
  const runTimer = (context: AudioContext) => {
    clearTimer();
    playbackTimer.current = window.setInterval(() => {
      const event = artifact.scoreEvents[eventIndex.current];
      if (!event) { stop(); return; }
      soundEvent(context, event);
      setActiveMeasure(event.measure);
      eventIndex.current += 1;
      setProgress(eventIndex.current / artifact.scoreEvents.length * 100);
    }, 90);
  };
  const play = () => {
    if (paused && contextRef.current) {
      void contextRef.current.resume();
      runTimer(contextRef.current);
      setPaused(false);
      setPlaying(true);
      return;
    }
    stop();
    const context = new window.AudioContext();
    contextRef.current = context;
    setPlaying(true);
    runTimer(context);
  };
  const pause = () => {
    if (!contextRef.current || !playing) return;
    clearTimer();
    void contextRef.current.suspend();
    setPlaying(false);
    setPaused(true);
  };
  const restart = () => { stop(); window.setTimeout(play, 0); };

  const submit = async () => {
    const result = await onValidate({ kind: "hex", value: answer });
    setStatus(result.correct ? "The glass holds the six signs." : "That reading does not appear in the developed glass.");
  };

  return <div
    aria-keyshortcuts="Space"
    aria-label="Glass Vespers keyboard transport"
    className="stack"
    onKeyDown={(event) => {
      const target = event.target as HTMLElement;
      if (event.key !== " " || ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      event.preventDefault();
      if (playing) pause();
      else play();
    }}
    role="region"
    tabIndex={0}
  >
    <section aria-label="Score transport" className="puzzle-audio-transport">
      <button aria-keyshortcuts="Space" className="button button--gold" onClick={playing ? pause : play} type="button">{playing ? "Pause" : paused ? "Resume" : "Play"}</button>
      <button className="button" disabled={!playing && !paused} onClick={stop} type="button">Stop</button>
      <button className="button" onClick={restart} type="button">Restart</button>
      <label>Score progress <progress max={100} value={progress}>{Math.round(progress)}%</progress></label>
      <span aria-live="polite">{activeMeasure >= 0 ? `Measure ${activeMeasure + 1} of 128` : "Ready"}</span>
    </section>
    <section aria-label="Sheet music" className="puzzle-score-book">{Array.from({ length: 4 }, (_, page) => <ScorePage activeMeasure={activeMeasure} artifact={artifact} key={page} page={page} />)}</section>
    <fieldset className="puzzle-glass-developer"><legend>Develop the glass</legend><label className="field">Retained notes per pane<select aria-label="Retained notes per pane" className="input" onChange={(event) => { setGroupSize(Number(event.target.value)); setStatus(""); }} value={groupSize}><option value="0">Choose</option><option value="5">Five</option><option value="6">Six</option><option value="7">Seven</option></select></label><label className="field">Control separator<select aria-label="Control separator" className="input" onChange={(event) => { setSeparator(event.target.value); setStatus(""); }} value={separator}><option value="">Choose</option>{["A", "F", "G"].map((note) => <option key={note}>{note}</option>)}</select></label></fieldset>
    {developed ? <ColorField cells={colorCells} /> : <p className="notice">The glass remains clouded. Choose how the score should be divided and developed.</p>}
    <section aria-label="Accessibility representations" className="puzzle-accessibility-controls"><h3>Alternative representations</h3><div className="action-row"><button aria-expanded={showTranscript || accessibleMode} className="button" onClick={() => setShowTranscript((value) => !value)} type="button">Captions and transcript</button><button aria-expanded={showTable || accessibleMode} className="button" onClick={() => setShowTable((value) => !value)} type="button">Note-event table</button><button aria-expanded={showTexture || accessibleMode} className="button" onClick={() => setShowTexture((value) => !value)} type="button">Texture on/off grid</button></div>
      {(showTranscript || accessibleMode) && <div aria-label="Score captions and transcript" className="puzzle-equivalent" role="region"><p>{artifact.scoreEvents.map((event) => event.control ? `control G after measure ${event.measure + 1}` : `measure ${event.measure + 1} beat ${event.beat + 1} note ${event.note}`).join("; ")}</p></div>}
      {(showTable || accessibleMode) && <div className="puzzle-equivalent"><table aria-label="Note-event table" className="puzzle-note-table"><thead><tr><th>Measure</th><th>Beat</th><th>Written note</th><th>Role</th></tr></thead><tbody>{artifact.scoreEvents.map((event, index) => <tr key={index}><td>{event.measure + 1}</td><td>{event.control ? "after" : event.beat + 1}</td><td>{event.note}</td><td>{event.control ? "control" : "score"}</td></tr>)}</tbody></table></div>}
      {(showTexture || accessibleMode) && <table aria-label="Texture on-off grid" className="puzzle-texture-grid"><caption>Each pane lists six retained positions; raised texture indicates A, C, or E and inset texture indicates B, D, or F.</caption><tbody>{Array.from({ length: 4 }, (_, row) => <tr key={row}>{colorCells.slice(row * 32, row * 32 + 32).map((cell, column) => <td aria-label={`Row ${row + 1}, column ${column + 1}: ${cell.split("").join(" ")}`} key={column}>{[...cell].map((note, index) => <span className={"ACE".includes(note) ? "is-raised" : "is-inset"} key={index}>{note}</span>)}</td>)}</tr>)}</tbody></table>}
    </section>
    <label className="field">Six hexadecimal characters<input aria-label="Six hexadecimal characters" autoCapitalize="characters" className="input puzzle-hex-input" inputMode="text" maxLength={6} onChange={(event) => { setAnswer(event.target.value); setStatus(""); }} pattern="[A-Fa-f]{6}" placeholder="A–F, six characters" value={answer} /></label>
    <button className="button button--gold" disabled={!developed || !answer.trim()} onClick={() => void submit()} type="button">Read the glass</button>
    {status && <p className={`notice ${status.startsWith("The glass holds") ? "notice--good" : "notice--bad"}`} role="status">{status}</p>}
  </div>;
});
