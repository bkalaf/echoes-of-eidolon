import { z } from "zod";

export const userSettingsInputSchema = z.object({
  audioMasterVolume: z.number().int().min(0).max(100),
  audioMuted: z.boolean(),
  audioNarrativeVolume: z.number().int().min(0).max(100),
  audioSoundtrackVolume: z.number().int().min(0).max(100),
  captions: z.boolean(),
  highContrast: z.boolean(),
  musicEnabled: z.boolean(),
  musicVolume: z.number().int().min(0).max(100),
  reducedMotion: z.boolean(),
  soundEnabled: z.boolean(),
  soundVolume: z.number().int().min(0).max(100),
  textSize: z.literal("DEFAULT"),
  theme: z.literal("DARK"),
}).strict();

export type UserSettingsInput = z.infer<typeof userSettingsInputSchema>;

export const defaultUserSettings: UserSettingsInput = Object.freeze({
  audioMasterVolume: 100,
  audioMuted: false,
  audioNarrativeVolume: 80,
  audioSoundtrackVolume: 70,
  captions: true,
  highContrast: false,
  musicEnabled: true,
  musicVolume: 70,
  reducedMotion: false,
  soundEnabled: true,
  soundVolume: 80,
  textSize: "DEFAULT",
  theme: "DARK",
});
