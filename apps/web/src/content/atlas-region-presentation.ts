import type { RegionId } from "../generated/prisma/enums";

export const atlasRegionPalette = {
  R01: "#00796B",
  R02: "#E66A00",
  R03: "#A67700",
  R04: "#1565C0",
  R05: "#C62828",
  R06: "#0077A0",
  R07: "#2E7D32",
  R08: "#6A1B9A",
  R09: "#3949AB",
  R10: "#E66A00",
  R11: "#C62828",
  R12: "#00796B",
  R13: "#0077A0",
  R14: "#A67700",
  R15: "#2E7D32",
  R16: "#6A1B9A",
  R17: "#1565C0",
  R18: "#6A1B9A",
  R19: "#E66A00",
  R20: "#2E7D32",
  R21: "#AD1457",
  R22: "#A67700",
  R23: "#C62828",
  R24: "#00796B",
  R25: "#0077A0",
} as const satisfies Record<RegionId, string>;

export function atlasRegionColor(regionId: RegionId): string {
  const color = atlasRegionPalette[regionId];
  if (!color) throw new Error(`Atlas Region ${regionId} has no presentation color.`);
  return color;
}
