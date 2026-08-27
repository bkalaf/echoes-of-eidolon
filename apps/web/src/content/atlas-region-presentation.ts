import type { RegionId } from "../generated/prisma/enums";
import { atlasRegionAdjacency } from "../data/atlas-region-adjacency";

export const atlasRegionPresentationColors = {
  BLACK: "#000000",
  BROWN: "#A52A2A",
  CYAN: "#00FFFF",
  FOREST_GREEN: "#228B22",
  LIME: "#00FF00",
  NAVY_BLUE: "#000080",
  ORANGE: "#FFA500",
  PINK: "#FFC0CB",
  PURPLE: "#800080",
  RED: "#FF0000",
  WHITE: "#FFFFFF",
  YELLOW: "#FFFF00",
} as const;

export const atlasRegionPalette = {
  R01: atlasRegionPresentationColors.WHITE,
  R02: atlasRegionPresentationColors.BLACK,
  R03: atlasRegionPresentationColors.BROWN,
  R04: atlasRegionPresentationColors.YELLOW,
  R05: atlasRegionPresentationColors.ORANGE,
  R06: atlasRegionPresentationColors.RED,
  R07: atlasRegionPresentationColors.LIME,
  R08: atlasRegionPresentationColors.CYAN,
  R09: atlasRegionPresentationColors.NAVY_BLUE,
  R10: atlasRegionPresentationColors.FOREST_GREEN,
  R11: atlasRegionPresentationColors.PURPLE,
  R12: atlasRegionPresentationColors.PINK,
  R13: atlasRegionPresentationColors.WHITE,
  R14: atlasRegionPresentationColors.BLACK,
  R15: atlasRegionPresentationColors.BROWN,
  R16: atlasRegionPresentationColors.YELLOW,
  R17: atlasRegionPresentationColors.ORANGE,
  R18: atlasRegionPresentationColors.RED,
  R19: atlasRegionPresentationColors.LIME,
  R20: atlasRegionPresentationColors.CYAN,
  R21: atlasRegionPresentationColors.NAVY_BLUE,
  R22: atlasRegionPresentationColors.FOREST_GREEN,
  R23: atlasRegionPresentationColors.PURPLE,
  R24: atlasRegionPresentationColors.PINK,
  R25: atlasRegionPresentationColors.WHITE,
} as const satisfies Record<RegionId, string>;

export function assertAtlasRegionPresentation(): void {
  const requestedColors = new Set(Object.values(atlasRegionPresentationColors));
  if (new Set(Object.values(atlasRegionPalette)).size !== requestedColors.size
    || Object.values(atlasRegionPalette).some((color) => !requestedColors.has(color))) {
    throw new Error("Atlas Region palette does not use the complete requested color set.");
  }
  for (const [regionId, neighbors] of Object.entries(atlasRegionAdjacency)) {
    for (const neighbor of neighbors) {
      if (atlasRegionPalette[regionId as RegionId] === atlasRegionPalette[neighbor]) {
        throw new Error(`Adjacent Atlas Regions ${regionId} and ${neighbor} share a color.`);
      }
    }
  }
}

export function atlasRegionColor(regionId: RegionId): string {
  const color = atlasRegionPalette[regionId];
  if (!color) throw new Error(`Atlas Region ${regionId} has no presentation color.`);
  return color;
}

export function atlasRegionLabelColor(regionId: RegionId): string {
  return atlasRegionColor(regionId) === atlasRegionPresentationColors.BLACK
    ? atlasRegionPresentationColors.WHITE
    : atlasRegionColor(regionId);
}
