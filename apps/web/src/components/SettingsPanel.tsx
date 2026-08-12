import { useEffect, useState } from "react";

import { defaultUserSettings, type UserSettingsInput } from "../domain/user-settings";

function applySettings(settings: UserSettingsInput) {
  document.documentElement.dataset.highContrast = String(settings.highContrast);
  document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
  document.documentElement.dataset.textSize = settings.textSize.toLowerCase();
  document.documentElement.dataset.theme = settings.theme.toLowerCase();
}

export function SettingsPanel({ closeHref }: { closeHref?: string }) {
  const [settings, setSettings] = useState<UserSettingsInput>(defaultUserSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/account/settings").then(async (response) => {
      const result = await response.json() as UserSettingsInput & { error?: string };
      if (!active) return;
      setLoading(false);
      if (!response.ok) setMessage(result.error ?? "Settings could not be loaded.");
      else { setSettings(result); applySettings(result); }
    }).catch(() => { if (active) { setLoading(false); setMessage("Settings could not be loaded."); } });
    return () => { active = false; };
  }, []);

  const set = <Key extends keyof UserSettingsInput>(key: Key, value: UserSettingsInput[Key]) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true); setMessage("");
    const response = await fetch("/api/account/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) });
    const result = await response.json() as UserSettingsInput & { error?: string };
    setSaving(false);
    if (!response.ok) setMessage(result.error ?? "Settings could not be saved.");
    else { setSettings(result); applySettings(result); setMessage("Settings saved."); }
  };

  return <section className="card settings-panel" aria-label="Shared account and game settings"><nav aria-label="Settings sections" className="tabs"><a className="active" href="#appearance">Appearance</a><a href="#accessibility">Accessibility</a><a href="#audio">Audio</a></nav>{loading ? <p className="notice">Loading settings…</p> : <div className="form-grid"><label className="field" id="appearance">Theme<select className="input" value={settings.theme} onChange={(event) => set("theme", event.target.value as "DARK")}><option value="DARK">Dark</option></select></label><label className="field">Text size<select className="input" value={settings.textSize} onChange={(event) => set("textSize", event.target.value as "DEFAULT")}><option value="DEFAULT">Default</option></select></label><fieldset className="field span-2 settings-options" id="accessibility"><legend>Accessibility</legend><label><input checked={settings.reducedMotion} onChange={(event) => set("reducedMotion", event.target.checked)} type="checkbox" /> Reduce animation and motion effects</label><label><input checked={settings.highContrast} onChange={(event) => set("highContrast", event.target.checked)} type="checkbox" /> Increase contrast</label><label><input checked={settings.captions} onChange={(event) => set("captions", event.target.checked)} type="checkbox" /> Show captions where available</label></fieldset><fieldset className="field span-2 settings-options" id="audio"><legend>Audio</legend><label><input checked={settings.audioMuted} onChange={(event) => set("audioMuted", event.target.checked)} type="checkbox" /> Mute all audio</label><label>Master volume <input aria-label="Master volume" disabled={settings.audioMuted} max={100} min={0} onChange={(event) => set("audioMasterVolume", Number(event.target.value))} type="range" value={settings.audioMasterVolume} /> {settings.audioMasterVolume}%</label><label>Soundtrack volume <input aria-label="Soundtrack volume" disabled={settings.audioMuted} max={100} min={0} onChange={(event) => set("audioSoundtrackVolume", Number(event.target.value))} type="range" value={settings.audioSoundtrackVolume} /> {settings.audioSoundtrackVolume}%</label><label>NPC &amp; Narrative volume <input aria-label="NPC and Narrative volume" disabled={settings.audioMuted} max={100} min={0} onChange={(event) => set("audioNarrativeVolume", Number(event.target.value))} type="range" value={settings.audioNarrativeVolume} /> {settings.audioNarrativeVolume}%</label></fieldset><div className="action-row span-2">{closeHref && <a className="button" href={closeHref}>Close</a>}<button className="button button--gold" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save settings"}</button></div></div>}{message && <p className={`notice ${message === "Settings saved." ? "notice--good" : "notice--bad"}`} role="status">{message}</p>}</section>;
}
