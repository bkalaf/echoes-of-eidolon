import { useEffect, useRef, useState } from "react";

import type { PublicProductionPuzzle } from "../../server/puzzle-production-generators";
import type { ProductionPlayerSubmission } from "../../server/puzzle-production-validation";

type Carrier = Extract<PublicProductionPuzzle["carrier"], { kind: "MUSICAL_HEX_GRID" }>;

const frequencies: Record<string, number> = { A: 220, B: 246.94, C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392 };

export function MusicalHexPuzzle({ accessibleMode, carrier, onValidate }: {
  accessibleMode: boolean;
  carrier: Carrier;
  onValidate: (submission: ProductionPlayerSubmission) => Promise<{ correct: boolean }>;
}) {
  const contextRef = useRef<AudioContext | undefined>(undefined);
  const progressTimer = useRef<number | undefined>(undefined);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("");

  const stop = () => {
    if (progressTimer.current !== undefined) window.clearInterval(progressTimer.current);
    progressTimer.current = undefined;
    if (contextRef.current) void contextRef.current.close();
    contextRef.current = undefined;
    setPlaying(false);
  };
  useEffect(() => () => {
    if (progressTimer.current !== undefined) window.clearInterval(progressTimer.current);
    if (contextRef.current) void contextRef.current.close();
  }, []);

  const play = () => {
    stop();
    const context = new window.AudioContext();
    contextRef.current = context;
    const secondsPerNote = 0.055;
    carrier.noteEvents.forEach((note, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = note === "G" ? "triangle" : "sine";
      oscillator.frequency.value = (frequencies[note] ?? 220) * [0.5, 1, 2][index % 3]!;
      const startsAt = context.currentTime + index * secondsPerNote;
      const endsAt = startsAt + (note === "G" ? 0.045 : 0.05);
      gain.gain.setValueAtTime(0.0001, startsAt);
      gain.gain.exponentialRampToValueAtTime(note === "G" ? 0.035 : 0.065, startsAt + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startsAt);
      oscillator.stop(endsAt);
    });
    const duration = carrier.noteEvents.length * secondsPerNote;
    const startedAt = performance.now();
    progressTimer.current = window.setInterval(() => {
      const next = Math.min(100, ((performance.now() - startedAt) / (duration * 1_000)) * 100);
      setProgress(next);
      if (next >= 100) stop();
    }, 200);
    setProgress(0);
    setHasPlayed(true);
    setPlaying(true);
  };

  const submit = async () => {
    const result = await onValidate({ kind: "hex", value: answer });
    setStatus(result.correct ? "Hexadecimal group accepted. The repetition is exact." : "That six-character group is not the repeated musical color.");
  };
  const groups = carrier.noteEvents.filter((note) => note !== "G").reduce<string[]>((result, note) => {
    const index = result.length - 1;
    if (index < 0 || result[index]!.length === 6) result.push(note);
    else result[index] += note;
    return result;
  }, []);

  return <div className="stack">
    <p>Listen for the written note names, not pitch intervals. A through F are hexadecimal characters; G marks a break and is not part of a group.</p>
    <section aria-label="Audio puzzle transport" className="puzzle-audio-transport">
      <button className="button button--gold" onClick={play} type="button">{hasPlayed ? "Replay melody" : "Play melody"}</button>
      <button className="button" disabled={!playing} onClick={stop} type="button">Stop</button>
      <label>Melody progress <progress max={100} value={progress}>{Math.round(progress)}%</progress></label>
    </section>
    {!accessibleMode && <div aria-label="Musical notation rail" className="puzzle-notation" role="img">{groups.map((group, index) => <span key={index}><small>{index + 1}</small>{group.split("").map((note, noteIndex) => <b key={noteIndex}>♪{note}</b>)}</span>)}</div>}
    <section aria-label="Melody captions" className="puzzle-equivalent" role="region"><h3>Captions</h3><p>{carrier.noteEvents.map((note) => note === "G" ? "control G" : `note ${note}`).join(" · ")}</p></section>
    {accessibleMode && <table aria-label="Texture-grid equivalent" className="puzzle-texture-grid"><caption>Non-audio 32 by 4 grouping field</caption><tbody>{Array.from({ length: 4 }, (_, row) => <tr key={row}>{groups.slice(row * 32, row * 32 + 32).map((group, column) => <td aria-label={`row ${row + 1}, column ${column + 1}: ${group.split("").join(" ")}`} className={`puzzle-texture puzzle-texture--${group.charCodeAt(0) % 6}`} key={column}>{group}</td>)}</tr>)}</tbody></table>}
    <label className="field">Six hexadecimal characters<input aria-label="Six hexadecimal characters" autoCapitalize="characters" className="input puzzle-hex-input" inputMode="text" maxLength={6} onChange={(event) => { setAnswer(event.target.value); setStatus(""); }} pattern="[A-Fa-f]{6}" placeholder="A–F, six characters" value={answer} /></label>
    <button className="button button--gold" disabled={!answer.trim()} onClick={() => void submit()} type="button">Check hexadecimal group</button>
    {status && <p className={`notice ${status.startsWith("Hexadecimal group accepted") ? "notice--good" : "notice--bad"}`} role="status">{status}</p>}
  </div>;
}
