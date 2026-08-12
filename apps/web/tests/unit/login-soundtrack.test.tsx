import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { loginSoundtrackKeys } from "../../src/content/managed-assets";
import { PublicShell } from "../../src/components/shells/Shells";
import {
  chooseLoginSoundtrack,
  consumeQueuedLoginSoundtrack,
  queueRandomLoginSoundtrack,
} from "../../src/domain/login-soundtrack";

describe("login soundtrack selection", () => {
  it("selects only one of the six supplied managed soundtracks", () => {
    expect(chooseLoginSoundtrack(0)).toBe(loginSoundtrackKeys[0]);
    expect(chooseLoginSoundtrack(0.999999)).toBe(loginSoundtrackKeys[5]);
    expect(new Set(loginSoundtrackKeys)).toHaveLength(6);
  });

  it("queues a logical key and consumes its content-addressed Spaces URL once", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => { values.delete(key); },
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const selected = queueRandomLoginSoundtrack(storage, 0.5);
    const url = consumeQueuedLoginSoundtrack(storage);

    expect(selected).toBe(loginSoundtrackKeys[3]);
    expect(url).toMatch(/^https:\/\/[^/]+\.digitaloceanspaces\.com\/assets\/[a-f0-9]{64}\.mp3$/);
    expect(consumeQueuedLoginSoundtrack(storage)).toBeUndefined();
  });

  it("does not play a legacy random soundtrack on a public route", () => {
    window.sessionStorage.setItem("echoes.login-soundtrack", loginSoundtrackKeys[0]);

    render(<PublicShell><p>Signed-in destination</p></PublicShell>);

    expect(screen.queryByLabelText("Login soundtrack")).not.toBeInTheDocument();
  });
});
