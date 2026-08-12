import { useState } from "react";

import { useGameAudio } from "./GameAudioEngine";

export function GameAudioMixer() {
  const [open, setOpen] = useState(false);
  const { currentTrackName, settings, update } = useGameAudio();
  const tooltip = currentTrackName ? `Current soundtrack: ${currentTrackName}` : undefined;
  return <div className="game-audio-mixer"><button aria-expanded={open} aria-label="Open audio mixer" className="button" onClick={() => setOpen((value) => !value)} title={tooltip} type="button"><svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" fill="currentColor" /></svg></button><button aria-label={settings.audioMuted ? "Unmute audio" : "Mute audio"} className="button" onClick={() => update("audioMuted", !settings.audioMuted)} type="button"><svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18"><path d="M4 9v6h4l5 4V5L8 9H4zm12-1 5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="2" /></svg></button>{open && <section aria-label="Audio mixer" className="audio-mixer-popover"><label>Master<input aria-label="Master volume" max={100} min={0} onChange={(event) => update("audioMasterVolume", Number(event.target.value))} type="range" value={settings.audioMasterVolume} /></label><label>Soundtrack<input aria-label="Soundtrack volume" max={100} min={0} onChange={(event) => update("audioSoundtrackVolume", Number(event.target.value))} type="range" value={settings.audioSoundtrackVolume} /></label><label>NPC &amp; Narrative<input aria-label="NPC and Narrative volume" max={100} min={0} onChange={(event) => update("audioNarrativeVolume", Number(event.target.value))} type="range" value={settings.audioNarrativeVolume} /></label></section>}</div>;
}
