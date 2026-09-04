import { describe, expect, it } from "vitest";

import { createF28Cells, PENTAGON_TILE_BY_HEX } from "../../src/components/atlas-f28";

describe("locked F28 Atlas topology", () => {
  it("generates the owner-locked F28 cell count and polygon split", () => {
    const cells = createF28Cells();
    expect(cells).toHaveLength(7_842);
    expect(cells.filter((cell) => cell.corners.length === 5)).toHaveLength(12);
    expect(cells.filter((cell) => cell.corners.length === 6)).toHaveLength(7_830);
  });

  it("reproduces the locked semantic pentagon identities and coordinates", () => {
    const cells = createF28Cells();
    const heavenfall = cells.find((cell) => cell.hexId === "HEX-0302");
    const earthFocus = cells.find((cell) => cell.hexId === "HEX-0992");
    const ringwoodVolcano = cells.find((cell) => cell.hexId === "HEX-6851");

    expect(PENTAGON_TILE_BY_HEX["HEX-0302"]).toBe("PENT_HEAVENFALL");
    expect(heavenfall?.pentagonTileId).toBe("PENT_HEAVENFALL");
    expect(heavenfall?.latitude).toBeCloseTo(67.417451, 5);
    expect(heavenfall?.longitude).toBeCloseTo(60.766054, 5);

    expect(PENTAGON_TILE_BY_HEX["HEX-0992"]).toBe("PENT_EARTH_FOCUS");
    expect(earthFocus?.pentagonTileId).toBe("PENT_EARTH_FOCUS");
    expect(earthFocus?.latitude).toBeCloseTo(48.442588, 5);
    expect(earthFocus?.longitude).toBeCloseTo(-102.304687, 5);

    expect(ringwoodVolcano?.pentagonTileId).toBe("PENT_VOLCANO_ISLE");
    expect(ringwoodVolcano?.latitude).toBeCloseTo(-48.442588, 5);
    expect(ringwoodVolcano?.longitude).toBeCloseTo(77.695312, 5);
  });
});
