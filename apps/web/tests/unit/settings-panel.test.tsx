import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPanel } from "../../src/components/SettingsPanel";
import { defaultUserSettings } from "../../src/domain/user-settings";

describe("shared settings panel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_request: RequestInfo | URL, init?: RequestInit) => ({
      json: async () => init?.body ? JSON.parse(String(init.body)) : defaultUserSettings,
      ok: true,
    })));
  });

  it("renders the governed controls and saves the same strict account-owned payload", async () => {
    render(<SettingsPanel closeHref="/game" />);
    expect(await screen.findByRole("checkbox", { name: /Show captions/ })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Theme" })).toHaveValue("DARK");
    expect(screen.getByRole("combobox", { name: "Text size" })).toHaveValue("DEFAULT");
    expect(screen.getByRole("slider", { name: "Music volume" })).toHaveValue("70");
    expect(screen.getByRole("slider", { name: "Sound volume" })).toHaveValue("80");
    fireEvent.click(screen.getByRole("checkbox", { name: /Reduce animation/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await vi.waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/account/settings", expect.objectContaining({ method: "PUT" })));
    const request = vi.mocked(fetch).mock.calls.at(-1)![1]!;
    expect(JSON.parse(String(request.body))).toEqual({ ...defaultUserSettings, reducedMotion: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Settings saved.");
    expect(document.documentElement.dataset.reducedMotion).toBe("true");
    expect(screen.getByRole("link", { name: "Close" })).toHaveAttribute("href", "/game");
  });
});
