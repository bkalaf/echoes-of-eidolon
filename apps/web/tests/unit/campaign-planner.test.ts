import { describe, expect, it } from "vitest";

import { campaignLinkedGroups, departmentCampaignDisposition, isValidCampaignSpan, linkedCampaignGroup } from "../../src/domain/campaign-planner";

describe("campaign planner contracts", () => {
  it("accepts only the approved multi-book spans", () => {
    expect(isValidCampaignSpan("PILLAR", [1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(true);
    expect(isValidCampaignSpan("PILLAR", [2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(false);
    expect(isValidCampaignSpan("LESSON", [7, 8, 9, 10, 11, 12])).toBe(true);
    expect(isValidCampaignSpan("IN_TRANSIT", [13, 14, 15, 16, 17, 18])).toBe(true);
    expect(isValidCampaignSpan("EXODUS", [16, 17, 18])).toBe(true);
    expect(isValidCampaignSpan("TRANSITION", [18, 1])).toBe(true);
    expect(isValidCampaignSpan("COMPANION", [2, 3])).toBe(true);
    expect(isValidCampaignSpan("DEJA_VU", [3, 4])).toBe(false);
  });

  it("keeps one-book objects and Holiday placements exact", () => {
    for (const type of ["ATROCITY", "WITNESS", "ARCHITECT", "LEGENDARY_REWARD", "WWII_INTERLUDE", "MYTH_INTERLUDE", "SCIENCE_INTERLUDE", "HISTORICAL_INTERLUDE"] as const) {
      expect(isValidCampaignSpan(type, [18])).toBe(true);
      expect(isValidCampaignSpan(type, [17, 18])).toBe(false);
    }
    for (const book of [1, 5, 10, 14]) expect(isValidCampaignSpan("HOLIDAY", [book])).toBe(true);
    expect(isValidCampaignSpan("HOLIDAY", [2])).toBe(false);
  });

  it("preserves the three exact linked drag groups", () => {
    expect(campaignLinkedGroups).toHaveLength(3);
    expect(linkedCampaignGroup("WITNESS")).toContain("LEGENDARY_REWARD");
    expect(linkedCampaignGroup("COMPANION")).toEqual(["COMPANION", "TRANSITION", "DEJA_VU"]);
    expect(linkedCampaignGroup("HOLIDAY")).toBeNull();
  });

  it("classifies only the controlled 54 Department rows", () => {
    expect(departmentCampaignDisposition("DEPT-001")).toBe("NORMAL_WITNESS_PATH");
    expect(departmentCampaignDisposition("DEPT-052")).toBe("NORMAL_WITNESS_PATH");
    expect(departmentCampaignDisposition("DEPT-053")).toBe("EXEMPT");
    expect(departmentCampaignDisposition("DEPT-054")).toBe("EXCLUDED");
    expect(() => departmentCampaignDisposition("DEPT-055")).toThrow(/controlled/);
  });
});
