import { describe, expect, it } from "vitest";

import {
  CampaignBookRangeError,
  campaignBookRange,
  campaignBookSegments,
  campaignBooksForDrop,
  campaignLinkedGroups,
  campaignObjectTypes,
  campaignPlannerColumns,
  campaignPlacementBookRange,
  campaignPlacementBookSegments,
  defaultDisjointTrilogy,
  departmentCampaignDisposition,
  duologyCounterpart,
  isCanonicalDuologyPair,
  isValidCampaignSpan,
  linkedCampaignGroup,
  opposingFactionGrouping,
  plannerColumnForObjectType,
  validateDisjointTrilogy,
} from "../../src/domain/campaign-planner";

describe("campaign planner contracts", () => {
  it.each([
    [[4], { endBook: 4, rowSpan: 1, startBook: 4 }],
    [[4, 5], { endBook: 5, rowSpan: 2, startBook: 4 }],
    [[4, 5, 6], { endBook: 6, rowSpan: 3, startBook: 4 }],
    [[4, 5, 6, 7, 8, 9], { endBook: 9, rowSpan: 6, startBook: 4 }],
    [[4, 5, 6, 7, 8, 9, 10, 11, 12], { endBook: 12, rowSpan: 9, startBook: 4 }],
  ])("derives an inclusive contiguous Book range from %j", (books, expected) => {
    expect(campaignBookRange(books)).toEqual(expected);
  });

  it("rejects empty, repeated, out-of-bounds, and non-contiguous Book membership", () => {
    for (const books of [[], [4, 4], [0], [4, 6]]) expect(() => campaignBookRange(books)).toThrow(CampaignBookRangeError);
  });

  it("derives every canonical duology from the single counterpart rule", () => {
    for (let book = 1; book <= 18; book += 1) expect(duologyCounterpart(book)).toBe(19 - book);
    for (let book = 1; book <= 9; book += 1) {
      expect(isCanonicalDuologyPair([book, 19 - book])).toBe(true);
      expect(isValidCampaignSpan("COMPANION", [book, 19 - book])).toBe(true);
    }
    expect(isCanonicalDuologyPair([2, 3])).toBe(false);
    expect(isValidCampaignSpan("COMPANION", [2, 3])).toBe(false);
  });

  it("projects canonical duology membership as two exact Book segments", () => {
    expect(campaignPlacementBookSegments("COMPANION", [4, 15])).toEqual([
      { endBook: 4, rowSpan: 1, startBook: 4 },
      { endBook: 15, rowSpan: 1, startBook: 15 },
    ]);
    expect(campaignPlacementBookSegments("TRANSITION", [9, 10])).toEqual([
      { endBook: 9, rowSpan: 1, startBook: 9 },
      { endBook: 10, rowSpan: 1, startBook: 10 },
    ]);
    expect(() => campaignPlacementBookRange("COMPANION", [4, 15])).toThrow(/multiple visual Book segments/);
  });

  it("projects non-contiguous explicit membership without filling its gaps", () => {
    expect(campaignBookSegments([1, 2, 3, 10, 11, 12])).toEqual([
      { endBook: 3, rowSpan: 3, startBook: 1 },
      { endBook: 12, rowSpan: 3, startBook: 10 },
    ]);
  });

  it("validates the editable Disjoint Trilogy as a complete three-value partition", () => {
    for (const world of ["CONCORD", "RUIN", "SCHISM"] as const) {
      const projected = validateDisjointTrilogy(defaultDisjointTrilogy(world), world);
      expect(projected).toHaveLength(3);
      expect(projected.flatMap((value) => value.bookNumbers).sort((a, b) => a - b)).toEqual(
        Array.from({ length: 18 }, (_, index) => index + 1),
      );
      expect(projected.every((value) => value.segments.length === 2 && value.segments.every((segment) => segment.rowSpan === 3))).toBe(true);
    }
    const overlapping = defaultDisjointTrilogy("CONCORD").map((value) => ({ ...value, bookNumbers: [...value.bookNumbers] }));
    overlapping[1]!.bookNumbers = [3, 4, 5, 13, 14, 15];
    expect(() => validateDisjointTrilogy(overlapping, "CONCORD")).toThrow(/exactly once/);
  });

  it("derives locked Opposing Faction membership without persisting an editable choice", () => {
    expect(opposingFactionGrouping("CONCORD")).toMatchObject({ logicalKey: "RUIN", editability: "LOCKED" });
    expect(opposingFactionGrouping("RUIN")).toMatchObject({ logicalKey: "SCHISM", editability: "LOCKED" });
    expect(opposingFactionGrouping("SCHISM")).toMatchObject({ logicalKey: "CONCORD", editability: "LOCKED" });
    expect(opposingFactionGrouping("CONCORD").segments).toEqual([
      { startBook: 1, endBook: 6, rowSpan: 6 },
      { startBook: 13, endBook: 18, rowSpan: 6 },
    ]);
  });

  it("derives valid placement membership from the drop target", () => {
    expect(campaignBooksForDrop("PILLAR", 4)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(campaignBooksForDrop("LESSON", 8)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(campaignBooksForDrop("EXODUS", 17)).toEqual([16, 17, 18]);
    expect(campaignBooksForDrop("COMPANION", 4)).toEqual([4, 15]);
    expect(() => campaignBooksForDrop("HOLIDAY", 2)).toThrow(/cannot be placed/);
  });

  it("maps every campaign object type into the reviewed fourteen-column topology", () => {
    expect(campaignPlannerColumns).toHaveLength(14);
    for (const objectType of campaignObjectTypes) expect(plannerColumnForObjectType(objectType)).not.toBeNull();
  });

  it("accepts only the approved multi-book spans", () => {
    expect(isValidCampaignSpan("PILLAR", [1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(true);
    expect(isValidCampaignSpan("PILLAR", [2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(false);
    expect(isValidCampaignSpan("LESSON", [7, 8, 9, 10, 11, 12])).toBe(true);
    expect(isValidCampaignSpan("IN_TRANSIT", [13, 14, 15, 16, 17, 18])).toBe(true);
    expect(isValidCampaignSpan("EXODUS", [16, 17, 18])).toBe(true);
    expect(isValidCampaignSpan("TRANSITION", [18, 1])).toBe(true);
    expect(isValidCampaignSpan("COMPANION", [2, 17])).toBe(true);
    expect(isValidCampaignSpan("COMPANION", [2, 3])).toBe(false);
    expect(isValidCampaignSpan("DEJA_VU", [3, 16])).toBe(true);
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
    expect(linkedCampaignGroup("WITNESS")?.required).toContainEqual({ count: 1, objectType: "LEGENDARY_REWARD" });
    expect(linkedCampaignGroup("WITNESS")?.optional).toEqual([{ count: "ZERO_OR_MORE", objectType: "HISTORICAL_INTERLUDE" }]);
    expect(linkedCampaignGroup("COMPANION")?.required.map((member) => member.objectType)).toEqual(["COMPANION", "TRANSITION", "DEJA_VU"]);
    expect(linkedCampaignGroup("LESSON")?.required).toContainEqual({ count: 2, objectType: "EXODUS" });
    expect(linkedCampaignGroup("HOLIDAY")).toBeNull();
  });

  it("classifies only the controlled 54 Department rows", () => {
    expect(departmentCampaignDisposition("DEPT-001")).toBe("NORMAL");
    expect(departmentCampaignDisposition("DEPT-052")).toBe("NORMAL");
    expect(departmentCampaignDisposition("DEPT-053")).toBe("EXEMPT");
    expect(departmentCampaignDisposition("DEPT-054")).toBe("EXCLUDED");
    expect(() => departmentCampaignDisposition("DEPT-055")).toThrow(/controlled/);
  });
});
