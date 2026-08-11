import { describe, expect, it, vi } from "vitest";

import { defaultUserSettings, userSettingsInputSchema } from "../../src/domain/user-settings";
import { getUserSettings, saveUserSettings } from "../../src/server/user-settings";

describe("shared user settings", () => {
  it("uses the governed wireframe defaults when the account has no persisted row", async () => {
    const database = { userSettings: { findUnique: vi.fn().mockResolvedValue(null) } } as never;
    expect(await getUserSettings("USER-1", database)).toEqual(defaultUserSettings);
  });

  it("persists one account-owned row shared by standalone, account, and game surfaces", async () => {
    const input = { ...defaultUserSettings, captions: false, highContrast: true, musicVolume: 55, reducedMotion: true };
    const upsert = vi.fn().mockResolvedValue(input);
    const database = { userSettings: { upsert } } as never;
    expect(await saveUserSettings("USER-1", input, database)).toEqual(input);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { ...input, userId: "USER-1" }, update: input, where: { userId: "USER-1" } }));
  });

  it("rejects unknown settings, unsupported theme inventions, and invalid volume", () => {
    expect(() => userSettingsInputSchema.parse({ ...defaultUserSettings, invented: true })).toThrow();
    expect(() => userSettingsInputSchema.parse({ ...defaultUserSettings, theme: "LIGHT" })).toThrow();
    expect(() => userSettingsInputSchema.parse({ ...defaultUserSettings, soundVolume: 101 })).toThrow();
  });
});
