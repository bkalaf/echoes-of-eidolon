import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { chooseSoundtrack } from "../domain/soundtrack";
import { defaultUserSettings, userSettingsInputSchema, type UserSettingsInput } from "../domain/user-settings";

interface Track { assetUrl: string; displayName: string | null; soundtrackId: string }
interface AudioContextValue {
  currentTrackName: string | null;
  settings: UserSettingsInput;
  update: <Key extends keyof UserSettingsInput>(key: Key, value: UserSettingsInput[Key]) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function useGameAudio() {
  const value = useContext(AudioContext);
  if (!value) throw new Error("Game audio controls must be rendered inside GameAudioEngine.");
  return value;
}

export function GameAudioEngine({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettingsInput>(defaultUserSettings);
  const [pool, setPool] = useState<Track[]>([]);
  const selected = useMemo(() => {
    const retained = pool.find((track) => track.soundtrackId === currentTrackId);
    return retained ?? chooseSoundtrack(pool, currentTrackId);
  }, [currentTrackId, pool]);

  useEffect(() => {
    void Promise.all([fetch("/api/account/settings"), fetch("/api/player/gameplay")]).then(async ([settingsResponse, gameplayResponse]) => {
      if (settingsResponse?.ok) {
        const parsed = userSettingsInputSchema.safeParse(await settingsResponse.json());
        if (parsed.success) setSettings(parsed.data);
      }
      if (gameplayResponse?.ok) {
        const result = await gameplayResponse.json() as { party?: null | { soundtracks?: Track[] } };
        setPool(result.party?.soundtracks ?? []);
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    element.muted = settings.audioMuted;
    const gain = settings.audioMuted ? 0 : (settings.audioMasterVolume / 100) * (settings.audioSoundtrackVolume / 100);
    element.volume = Number.isFinite(gain) ? Math.max(0, Math.min(1, gain)) : 0;
  }, [settings.audioMasterVolume, settings.audioMuted, settings.audioSoundtrackVolume]);

  useEffect(() => {
    const element = audio.current;
    if (!element || !selected || currentTrackId === selected.soundtrackId) return;
    setCurrentTrackId(selected.soundtrackId);
    element.src = selected.assetUrl;
    element.load();
    void element.play().catch(() => undefined);
  }, [currentTrackId, selected]);

  const update: AudioContextValue["update"] = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    void fetch("/api/account/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
  };
  return <AudioContext.Provider value={{ currentTrackName: selected?.displayName ?? null, settings, update }}><audio aria-label="Game soundtrack" hidden ref={audio} />{children}</AudioContext.Provider>;
}
