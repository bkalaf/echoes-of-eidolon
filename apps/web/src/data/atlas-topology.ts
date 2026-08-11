import type { LatticeId, RegionId } from "../generated/prisma/enums";

export interface CanonicalRegionLatticeMapping {
  latticeId: LatticeId;
  locked: boolean;
  regionId: RegionId;
}

export type CanonicalAtlasConnectionType = "BASE" | "LEFT_RIGHT_CROSSOVER" | "NORMAL";
export type CanonicalAtlasWrapMode = "DATE_LINE" | "NONE";

export interface CanonicalAtlasConnection {
  atlasConnectionId: string;
  connectionType: CanonicalAtlasConnectionType;
  fromLatticeId: LatticeId;
  locked: boolean;
  toLatticeId: LatticeId;
  wrapMode: CanonicalAtlasWrapMode;
}

const mappingTuples = [
  ["R01", "L03"], ["R02", "L01"], ["R03", "L02"], ["R04", "L04"], ["R05", "L08"],
  ["R06", "L14"], ["R07", "L07"], ["R08", "L06"], ["R09", "L09"], ["R10", "L10"],
  ["R11", "L15"], ["R12", "L20"], ["R13", "L24"], ["R14", "L19"], ["R15", "L05"],
  ["R16", "L25"], ["R17", "L11"], ["R18", "L12"], ["R19", "L13"], ["R20", "L18"],
  ["R21", "L17"], ["R22", "L23"], ["R23", "L21"], ["R24", "L16"], ["R25", "L22"],
] as const satisfies readonly (readonly [RegionId, LatticeId])[];

const basePairs = [
  ["L01", "L02"], ["L01", "L06"], ["L01", "L07"], ["L02", "L03"], ["L02", "L07"],
  ["L03", "L04"], ["L03", "L08"], ["L04", "L05"], ["L04", "L09"], ["L05", "L09"],
  ["L05", "L10"], ["L06", "L07"], ["L06", "L11"], ["L08", "L12"], ["L08", "L13"],
  ["L09", "L10"], ["L10", "L15"], ["L11", "L12"], ["L11", "L16"], ["L12", "L13"],
  ["L13", "L14"], ["L13", "L18"], ["L14", "L15"], ["L14", "L18"], ["L15", "L20"],
  ["L16", "L17"], ["L16", "L21"], ["L17", "L21"], ["L17", "L22"], ["L18", "L23"],
  ["L19", "L20"], ["L19", "L24"], ["L19", "L25"], ["L20", "L25"], ["L21", "L22"],
  ["L22", "L23"], ["L23", "L24"], ["L24", "L25"],
] as const satisfies readonly (readonly [LatticeId, LatticeId])[];

const crossoverPairs = [
  ["L01", "L05"], ["L06", "L10"], ["L11", "L15"], ["L16", "L20"], ["L21", "L25"],
] as const satisfies readonly (readonly [LatticeId, LatticeId])[];

function connection(
  [fromLatticeId, toLatticeId]: readonly [LatticeId, LatticeId],
  connectionType: CanonicalAtlasConnectionType,
  wrapMode: CanonicalAtlasWrapMode,
): CanonicalAtlasConnection {
  return {
    atlasConnectionId: `ATLAS-CONNECTION-${fromLatticeId}-${toLatticeId}`,
    connectionType,
    fromLatticeId,
    locked: true,
    toLatticeId,
    wrapMode,
  };
}

export const atlasRegionMappings: readonly CanonicalRegionLatticeMapping[] = mappingTuples.map(([regionId, latticeId]) => ({
  latticeId,
  locked: true,
  regionId,
}));

export const atlasConnections: readonly CanonicalAtlasConnection[] = [
  ...basePairs.map((pair) => connection(pair, "BASE", "NONE")),
  ...crossoverPairs.map((pair) => connection(pair, "LEFT_RIGHT_CROSSOVER", "DATE_LINE")),
  connection(["L04", "L11"], "NORMAL", "NONE"),
];
