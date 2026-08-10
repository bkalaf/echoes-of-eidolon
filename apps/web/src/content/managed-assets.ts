import manifest from "../data/managed-assets.json";

export type ManagedAssetKey = keyof typeof manifest;

export function managedAssetUrl(key: ManagedAssetKey): string {
  return manifest[key].publicUrl;
}

export function managedAssetRecord(key: ManagedAssetKey) {
  return manifest[key];
}

export const loginSoundtrackKeys = [
  "soundtrack.english-anglo.city",
  "soundtrack.english-anglo.tavern",
  "soundtrack.mississippian-eastern-woodlands.city",
  "soundtrack.mississippian-eastern-woodlands.tavern",
  "soundtrack.taino.city",
  "soundtrack.taino.tavern",
] as const satisfies readonly ManagedAssetKey[];
