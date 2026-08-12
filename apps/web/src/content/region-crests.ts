import type { RegionId, WorldKey } from "../generated/prisma/enums";

export const crestAssetFileNames = [
  "R01.svg", "R02.svg", "R03.svg", "R04.svg", "R05.svg", "R06-C.svg", "R06.svg", "R07.svg", "R08.svg", "R09.svg",
  "R10-C.svg", "R10-R.svg", "R10-S.svg", "R11-S.svg", "R11.svg", "R12.svg", "R13.svg", "R14.svg", "R15.svg", "R16.svg",
  "R17.svg", "R18.svg", "R19.svg", "R20.svg", "R21.svg", "R22-R.svg", "R22.svg", "R23.svg", "R24.svg", "R25.svg",
] as const;

export type CrestAssetFileName = (typeof crestAssetFileNames)[number];
export type CrestColor = "blue" | "yellow" | "red";
export type CrestWorld = WorldKey | "Concord" | "Ruin" | "Schism";

const availableCrestAssets = new Set<string>(crestAssetFileNames);
const worldSuffixes = { CONCORD: "C", RUIN: "R", SCHISM: "S" } as const;

export function normalizeRegionId(region: RegionId | string | number): RegionId {
  const match = String(region).trim().toUpperCase().match(/^R?0*(\d{1,2})$/);
  const number = match ? Number(match[1]) : Number.NaN;
  if (!Number.isInteger(number) || number < 1 || number > 25) {
    throw new Error(`Unsupported canonical region: ${String(region)}`);
  }
  return `R${String(number).padStart(2, "0")}` as RegionId;
}

function worldSuffix(world: CrestWorld): (typeof worldSuffixes)[keyof typeof worldSuffixes] {
  const normalized = String(world).trim().toUpperCase();
  const suffix = worldSuffixes[normalized as keyof typeof worldSuffixes];
  if (!suffix) throw new Error(`Unsupported crest world: ${String(world)}`);
  return suffix;
}

export function resolveRegionCrestFileName(region: RegionId | string | number, world?: CrestWorld): CrestAssetFileName {
  const regionId = normalizeRegionId(region);
  if (world) {
    const preferred = `${regionId}-${worldSuffix(world)}.svg`;
    if (availableCrestAssets.has(preferred)) return preferred as CrestAssetFileName;
  }
  const fallback = `${regionId}.svg`;
  if (availableCrestAssets.has(fallback)) return fallback as CrestAssetFileName;
  const deterministicVariant = (["C", "R", "S"] as const)
    .map((suffix) => `${regionId}-${suffix}.svg`)
    .find((fileName) => availableCrestAssets.has(fileName));
  if (!deterministicVariant) throw new Error(`Missing crest asset for ${regionId}.`);
  return deterministicVariant as CrestAssetFileName;
}

export function resolveRegionCrestAsset(region: RegionId | string | number, world?: CrestWorld): string {
  return `/crests/${resolveRegionCrestFileName(region, world)}`;
}
