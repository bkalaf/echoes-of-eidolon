import { describe, expect, it } from "vitest";

import { highestEarnedRanks, reduceCapabilityEvents, rewardEvidenceWeights, scoreRewardEvidence } from "../../src/domain/capabilities";

describe("capability authority", () => {
  it("reduces validated SET and ADD events in sequence order", () => {
    const state = reduceCapabilityEvents([
      { capabilityDefinitionId: "DEF-SCORE", key: "score", valueKind: "SCORE", minValue: 0, maxValue: 10 },
      { capabilityDefinitionId: "DEF-BOOL", key: "seen", valueKind: "BOOLEAN" },
      { capabilityDefinitionId: "DEF-ENUM", key: "phase", valueKind: "ENUM", enumValues: ["A", "B"] },
    ], [
      { capabilityEventId: "E3", capabilityDefinitionId: "DEF-SCORE", sequence: 3n, operation: "ADD", value: 4 },
      { capabilityEventId: "E1", capabilityDefinitionId: "DEF-SCORE", sequence: 1n, operation: "SET", value: 2 },
      { capabilityEventId: "E2", capabilityDefinitionId: "DEF-BOOL", sequence: 2n, operation: "SET", value: true },
      { capabilityEventId: "E4", capabilityDefinitionId: "DEF-ENUM", sequence: 4n, operation: "SET", value: "B" },
    ]);
    expect(state.get("DEF-SCORE")?.value).toBe(6);
    expect(state.get("DEF-BOOL")?.value).toBe(true);
    expect(state.get("DEF-ENUM")?.value).toBe("B");
  });

  it("fails closed on unknown definitions, bad kinds, bad operations, range violations, and duplicate order", () => {
    const definition = [{ capabilityDefinitionId: "DEF", key: "flag", valueKind: "BOOLEAN" as const }];
    const event = { capabilityEventId: "E1", capabilityDefinitionId: "DEF", sequence: 1n, operation: "SET" as const, value: true };
    expect(() => reduceCapabilityEvents(definition, [{ ...event, capabilityDefinitionId: "UNKNOWN" }])).toThrow(/Unknown CapabilityDefinition/);
    expect(() => reduceCapabilityEvents(definition, [{ ...event, value: 1 }])).toThrow(/boolean/);
    expect(() => reduceCapabilityEvents(definition, [{ ...event, operation: "ADD" }])).toThrow(/does not support ADD/);
    expect(() => reduceCapabilityEvents(definition, [event, { ...event, capabilityEventId: "E2" }])).toThrow(/Duplicate CapabilityEvent sequence/);
    expect(() => reduceCapabilityEvents(
      [{ capabilityDefinitionId: "DEF", key: "score", valueKind: "SCORE", maxValue: 2 }],
      [{ ...event, value: 3 }],
    )).toThrow(/authored maximum/);
  });

  it("uses only the supplied evidence weights and honors an authored ceiling", () => {
    expect(rewardEvidenceWeights).toEqual({ RUMOR: 50, EVIDENCE: 100, PROOF: 200, DOUBT: -50, CONTRADICTION: -100, REFUTATION: -200 });
    expect(scoreRewardEvidence(["PROOF", "EVIDENCE", "RUMOR"], 225)).toBe(225);
    expect(scoreRewardEvidence(["REFUTATION", "RUMOR"], 500)).toBe(-150);
  });

  it("shows only the highest earned rank in each chain without evaluating unsupplied award rules", () => {
    expect(highestEarnedRanks([
      { achievementDefinitionId: "A1", chainKey: "CHAIN-A", rank: 1 },
      { achievementDefinitionId: "A3", chainKey: "CHAIN-A", rank: 3 },
      { achievementDefinitionId: "B2", chainKey: "CHAIN-B", rank: 2 },
    ])).toEqual([
      { achievementDefinitionId: "A3", chainKey: "CHAIN-A", rank: 3 },
      { achievementDefinitionId: "B2", chainKey: "CHAIN-B", rank: 2 },
    ]);
  });
});
