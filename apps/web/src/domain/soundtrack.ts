export type SoundtrackCategory = "CITY" | "TAVERN";

export interface SoundtrackSourceIdentity {
  category: SoundtrackCategory;
  cultureKey: string;
  displayName: string;
  sourceFilename: string;
}

export function parseSoundtrackSourcePath(sourcePath: string): SoundtrackSourceIdentity | null {
  const normalized = sourcePath.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  const sourceFilename = parts.at(-1) ?? "";
  const cultureKey = parts.at(-2) ?? "";
  if (!/^CULTURE_[A-Z0-9_]+$/.test(cultureKey)) return null;
  const match = /^(CULTURE_[A-Z0-9_]+)_(CITY|TAVERN)\.mp3$/.exec(sourceFilename);
  if (!match || match[1] !== cultureKey) return null;
  const category = match[2] as SoundtrackCategory;
  const cultureName = cultureKey.replace(/^CULTURE_/, "").split("_").map((word) => `${word[0]}${word.slice(1).toLowerCase()}`).join(" ");
  return { category, cultureKey, displayName: `${cultureName} · ${category === "CITY" ? "City" : "Tavern"}`, sourceFilename };
}

export function chooseSoundtrack<T extends { soundtrackId: string }>(pool: readonly T[], previousId: string | null, random: () => number = Math.random): T | null {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0]!;
  const candidates = pool.filter((track) => track.soundtrackId !== previousId);
  const index = Math.min(candidates.length - 1, Math.floor(Math.max(0, random()) * candidates.length));
  return candidates[index]!;
}
