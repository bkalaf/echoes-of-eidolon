import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameAudioEngine } from "../../src/components/GameAudioEngine";
import { GameAudioMixer } from "../../src/components/GameAudioMixer";
import { defaultUserSettings } from "../../src/domain/user-settings";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("game-only soundtrack controls", () => {
  it("uses the existing mixer buses without native transport and preserves values while muted", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT") return { ok: true, json: async () => defaultUserSettings } as Response;
      if (url.includes("/api/account/settings")) return { ok: true, json: async () => defaultUserSettings } as Response;
      return { ok: true, json: async () => ({ party: { soundtracks: [{ assetUrl: "/assets/track.mp3", displayName: "Hearth Song", soundtrackId: "TRACK" }] } }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<GameAudioEngine><GameAudioMixer /></GameAudioEngine>);
    const audio = container.querySelector("audio")!;
    expect(audio).not.toHaveAttribute("controls");
    expect(audio).toHaveAttribute("hidden");
    const open = await screen.findByRole("button", { name: "Open audio mixer" });
    await waitFor(() => expect(open).toHaveAttribute("title", "Current soundtrack: Hearth Song"));
    fireEvent.click(open);
    expect(screen.getByRole("slider", { name: "Master volume" })).toHaveValue("100");
    expect(screen.getByRole("slider", { name: "Soundtrack volume" })).toHaveValue("70");
    expect(screen.getByRole("slider", { name: "NPC and Narrative volume" })).toHaveValue("80");
    expect(screen.queryByRole("button", { name: /pause|skip|seek/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "Master volume" }), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Mute audio" }));
    expect(screen.getByRole("slider", { name: "Soundtrack volume" })).toHaveValue("70");
    expect(screen.getByRole("slider", { name: "NPC and Narrative volume" })).toHaveValue("80");
    await waitFor(() => expect(audio.muted).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/account/settings", expect.objectContaining({ method: "PUT" }));
  });

  it("does not expose soundtrack identity when the server omits the privileged display name", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => String(input).includes("settings")
      ? { ok: true, json: async () => defaultUserSettings }
      : { ok: true, json: async () => ({ party: { soundtracks: [{ assetUrl: "/assets/track.mp3", displayName: null, soundtrackId: "TRACK" }] } }) }));
    render(<GameAudioEngine><GameAudioMixer /></GameAudioEngine>);
    const open = await screen.findByRole("button", { name: "Open audio mixer" });
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    expect(open).not.toHaveAttribute("title");
  });
});
