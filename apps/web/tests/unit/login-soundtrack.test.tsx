import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

  it("loads the queued soundtrack after sign-in returns to a public route", async () => {
    window.sessionStorage.setItem("echoes.login-soundtrack", loginSoundtrackKeys[0]);
    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);

    render(<PublicShell><p>Signed-in destination</p></PublicShell>);

    const player = screen.getByLabelText("Login soundtrack");
    await waitFor(() => expect(load).toHaveBeenCalledOnce());
    expect(player).not.toHaveAttribute("hidden");
    expect(player).toHaveAttribute("src", expect.stringMatching(/^https:\/\/[^/]+\.digitaloceanspaces\.com\/assets\/[a-f0-9]{64}\.mp3$/));
    expect(window.sessionStorage.getItem("echoes.login-soundtrack")).toBeNull();

    load.mockRestore();
  });
});
