import { defaultUserSettings, userSettingsInputSchema, type UserSettingsInput } from "../domain/user-settings";
import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";

type Database = PrismaClient;

const userSettingsSelect = {
  captions: true,
  highContrast: true,
  musicEnabled: true,
  musicVolume: true,
  reducedMotion: true,
  soundEnabled: true,
  soundVolume: true,
  textSize: true,
  theme: true,
} as const;

export async function getUserSettings(userId: string, database: Database = getDatabase()): Promise<UserSettingsInput> {
  const settings = await database.userSettings.findUnique({ where: { userId }, select: userSettingsSelect });
  return settings ? userSettingsInputSchema.parse(settings) : defaultUserSettings;
}

export async function saveUserSettings(userId: string, input: UserSettingsInput, database: Database = getDatabase()): Promise<UserSettingsInput> {
  const settings = userSettingsInputSchema.parse(input);
  return userSettingsInputSchema.parse(await database.userSettings.upsert({
    where: { userId },
    create: { ...settings, userId },
    update: settings,
    select: userSettingsSelect,
  }));
}
