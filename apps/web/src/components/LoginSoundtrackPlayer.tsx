import { useEffect, useRef } from "react";

import { consumeQueuedLoginSoundtrack } from "../domain/login-soundtrack";

export function LoginSoundtrackPlayer() {
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const source = consumeQueuedLoginSoundtrack();
    if (!source || !audio.current) return;
    audio.current.src = source;
    audio.current.hidden = false;
    audio.current.load();
  }, []);

  return <audio className="login-soundtrack" controls hidden preload="metadata" ref={audio} aria-label="Login soundtrack" />;
}
