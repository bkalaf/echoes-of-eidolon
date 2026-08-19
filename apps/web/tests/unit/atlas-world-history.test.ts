import { describe, expect, it } from "vitest";

import {
  AFFECTED_INITIAL_REGION_POPULATIONS,
  federalCapitalRegionId,
  INITIAL_FOUNDING_REGION_IDS,
  INNERWOOD_REGION_ID,
  INNERWOOD_SITE_ID,
  INNERWOOD_WORLD_DIVERGENCE,
  resolveSettlementWorldName,
  settlementExistsInAtlasHistory,
} from "../../src/domain/atlas-world-history";

describe("Atlas world-specific founding history", () => {
  it("has 24 original founding regions and excludes R10", () => {
    expect(INITIAL_FOUNDING_REGION_IDS).toHaveLength(24);
    expect(INITIAL_FOUNDING_REGION_IDS).not.toContain(INNERWOOD_REGION_ID);
    expect(INNERWOOD_SITE_ID).toBe("SITE-0243");
    expect(settlementExistsInAtlasHistory("R10", "INITIAL")).toBe(false);
    expect(settlementExistsInAtlasHistory("R10", "POST_DJT")).toBe(true);
  });

  it("resolves world-specific Innerwood names without a slash-delimited persistence value", () => {
    expect(resolveSettlementWorldName({ fallbackName: "Shahravan", regionId: "R10", worldKey: "CONCORD" })).toBe("Ashgarden");
    expect(resolveSettlementWorldName({ fallbackName: "Shahravan", regionId: "R10", worldKey: "SCHISM" })).toBe("Second Song");
    expect(resolveSettlementWorldName({ fallbackName: "Shahravan", regionId: "R10", worldKey: "RUIN" })).toBe("Last Well");
  });

  it("keeps federal-capital status world-specific and post-DJT only", () => {
    expect(federalCapitalRegionId("CONCORD", "INITIAL")).toBeNull();
    expect(federalCapitalRegionId("CONCORD", "POST_DJT")).toBe("R06");
    expect(federalCapitalRegionId("SCHISM", "POST_DJT")).toBe("R22");
    expect(federalCapitalRegionId("RUIN", "POST_DJT")).toBe("R11");
  });

  it("locks the three divergent Innerwood founding populations", () => {
    expect(INNERWOOD_WORLD_DIVERGENCE.CONCORD.foundingPopulation).toEqual([
      "Iranian, Kurdish & Eastern West Asian",
      "Caucasian & Anatolian",
      "Djinn & Genie-Kin",
    ]);
    expect(INNERWOOD_WORLD_DIVERGENCE.SCHISM.foundingPopulation).toEqual([
      "Australian Indigenous",
      "Marsupials & Monotremes",
      "Other Specialized Birds",
    ]);
    expect(INNERWOOD_WORLD_DIVERGENCE.RUIN.foundingPopulation).toEqual([
      "Arabian Peninsula",
      "North African & Saharan",
      "Elephants, Hyraxes & Afrotherians",
    ]);
  });

  it("locks Highcourt and Forestfold population corrections", () => {
    expect(AFFECTED_INITIAL_REGION_POPULATIONS.R06).toEqual([
      "Iranian, Kurdish & Eastern West Asian",
      "Angels & Celestials",
      "Djinn & Genie-Kin",
    ]);
    expect(AFFECTED_INITIAL_REGION_POPULATIONS.R15).toEqual([
      "South Asian",
      "Primates",
      "Caucasian & Anatolian",
    ]);
  });
});
