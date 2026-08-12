import { useEffect, useRef } from "react";

import { consumeQueuedLoginSoundtrack } from "../domain/login-soundtrack";

export function LoginSoundtrackPlayer() {
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const source = consumeQueuedLoginSoundtrack();
    if (!source || !audio.current) return;
    audio.current.src = source;
    audio.current.hidden = false;
    void fetch("/api/account/settings").then(async (response) => {
      if (!response.ok || !audio.current) return;
      const settings = await response.json() as { audioMasterVolume: number; audioMuted: boolean; audioSoundtrackVolume: number };
      audio.current.muted = settings.audioMuted;
      audio.current.volume = (settings.audioMasterVolume / 100) * (settings.audioSoundtrackVolume / 100);
      audio.current.load();
    }).catch(() => undefined);
  }, []);

  return <audio className="login-soundtrack" hidden preload="metadata" ref={audio} aria-label="Login soundtrack" />;
}
