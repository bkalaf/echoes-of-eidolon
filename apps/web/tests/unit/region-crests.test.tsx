import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RegionCrest } from "../../src/components/RegionCrest";
import {
  crestAssetFileNames,
  normalizeRegionId,
  resolveRegionCrestAsset,
} from "../../src/content/region-crests";

describe("regional crest assets", () => {
  it("owns the exact base and world-specific SVG manifest", () => {
    expect(crestAssetFileNames).toEqual([
      "R01.svg", "R02.svg", "R03.svg", "R04.svg", "R05.svg", "R06-C.svg", "R06.svg", "R07.svg", "R08.svg", "R09.svg",
      "R10-C.svg", "R10-R.svg", "R10-S.svg", "R11-S.svg", "R11.svg", "R12.svg", "R13.svg", "R14.svg", "R15.svg", "R16.svg",
      "R17.svg", "R18.svg", "R19.svg", "R20.svg", "R21.svg", "R22-R.svg", "R22.svg", "R23.svg", "R24.svg", "R25.svg",
    ]);
  });

  it.each([
    ["R06", "R06"],
    ["r6", "R06"],
    ["06", "R06"],
    [6, "R06"],
  ] as const)("normalizes supported region value %s", (input, expected) => {
    expect(normalizeRegionId(input)).toBe(expected);
  });

  it.each(["R00", "R26", "Highcourt", 0, 26])("rejects unsupported region value %s", (input) => {
    expect(() => normalizeRegionId(input)).toThrow(/region/i);
  });

  it("resolves supplied world variants and falls back before producing a URL", () => {
    expect(resolveRegionCrestAsset("R06")).toBe("/crests/R06.svg");
    expect(resolveRegionCrestAsset("R06", "Concord")).toBe("/crests/R06-C.svg");
    expect(resolveRegionCrestAsset("R10", "Ruin")).toBe("/crests/R10-R.svg");
    expect(resolveRegionCrestAsset("R11", "Schism")).toBe("/crests/R11-S.svg");
    expect(resolveRegionCrestAsset("R22", "Ruin")).toBe("/crests/R22-R.svg");
    expect(resolveRegionCrestAsset("R06", "Ruin")).toBe("/crests/R06.svg");
    expect(resolveRegionCrestAsset("R22", "Concord")).toBe("/crests/R22.svg");
    expect(resolveRegionCrestAsset("R10")).toBe("/crests/R10-C.svg");
  });

  it("renders one consistently sized inline vector reference without a recoloring mask", () => {
    const { container } = render(<RegionCrest color="blue" region="r6" world="Concord" />);
    const crest = container.querySelector(".region-crest");
    expect(crest).not.toBeNull();
    expect(crest).toHaveClass("region-crest", "region-crest--blue");
    expect(crest).toHaveAttribute("aria-hidden", "true");
    expect(crest).toHaveAttribute("data-crest-asset", "R06-C.svg");
    expect(crest?.tagName).toBe("svg");
    expect(crest?.querySelector("use")).toHaveAttribute("href", "/crests/region-crests.svg#crest-R06-C");
    expect(crest).not.toHaveAttribute("style");
  });
});
