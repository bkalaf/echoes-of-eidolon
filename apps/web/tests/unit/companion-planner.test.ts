import { describe, expect, it } from "vitest";

import { validateCompanionPlanner, type PlannerAssignment } from "../../src/domain/companion-planner";

const affinity = new Map([["SCHOLAR", new Set(["INTELLIGENCE", "WISDOM"])], ["SCOUT", new Set(["DEXTERITY", "WISDOM"])], ["ORATOR", new Set(["CHARISMA", "WISDOM"])]]);
const rows: PlannerAssignment[] = [
  { awarenessSkill: "EMPATHY", breedId: "B1", companionKey: "A", faction: "CONCORD", knowledgeSkill: "LORE", occupationId: "SCHOLAR", primaryAttribute: "INTELLIGENCE", secondaryAttribute: "INTELLIGENCE", worldKey: "CONCORD" },
  { awarenessSkill: null, breedId: "B2", companionKey: "A", faction: "RUIN", knowledgeSkill: null, occupationId: "SCOUT", primaryAttribute: "DEXTERITY", secondaryAttribute: "WISDOM", worldKey: "RUIN" },
  { awarenessSkill: "GUARDIAN", breedId: "B3", companionKey: "A", faction: "SCHISM", knowledgeSkill: "TRACE", occupationId: "ORATOR", primaryAttribute: "CHARISMA", secondaryAttribute: "WISDOM", worldKey: "SCHISM" },
];

describe("companion planner validation", () => {
  it("allows primary and secondary to match and skips nullable skill cells", () => expect(validateCompanionPlanner(rows, affinity)).toEqual([]));
  it("reports exact cells for pair reuse, affinity mismatch, and incomplete faction rotation", () => {
    const invalid = [...rows, { ...rows[0]!, companionKey: "B", breedId: "B4", occupationId: "SCOUT", faction: "CONCORD" }];
    const issues = validateCompanionPlanner(invalid, affinity);
    expect(issues.map((issue) => issue.cell)).toContain("CONCORD.B.attributes");
    expect(issues.map((issue) => issue.cell)).toContain("CONCORD.B.faction");
  });
});
