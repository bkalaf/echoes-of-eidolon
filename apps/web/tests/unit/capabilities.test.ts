import { describe, expect, it } from "vitest";

import { highestEarnedRanks, reduceCapabilityEvents, rewardEvidenceWeights, scoreRewardEvidence } from "../../src/domain/capabilities";

describe("capability authority", () => {
  it("reduces validated SET and ADD events in sequence order", () => {
    const occurredAt = new Date("2026-08-10T00:00:00.000Z");
    const state = reduceCapabilityEvents([
      { capabilityDefinitionId: "DEF-SCORE", key: "score", valueKind: "SCORE", minValue: 0, maxValue: 10 },
      { capabilityDefinitionId: "DEF-BOOL", key: "seen", valueKind: "BOOLEAN" },
      { capabilityDefinitionId: "DEF-ENUM", key: "phase", valueKind: "ENUM", enumValues: ["A", "B"] },
    ], [
      { capabilityEventId: "E3", capabilityDefinitionId: "DEF-SCORE", occurredAt, sequence: 3n, operation: "ADD", scoreValue: 4 },
      { capabilityEventId: "E1", capabilityDefinitionId: "DEF-SCORE", occurredAt, sequence: 1n, operation: "SET", scoreValue: 2 },
      { capabilityEventId: "E2", capabilityDefinitionId: "DEF-BOOL", occurredAt, sequence: 2n, operation: "SET", booleanValue: true },
      { capabilityEventId: "E4", capabilityDefinitionId: "DEF-ENUM", occurredAt, sequence: 4n, operation: "SET", enumValue: "B" },
    ]);
    expect(state.get("DEF-SCORE")?.value).toBe(6);
    expect(state.get("DEF-BOOL")?.value).toBe(true);
    expect(state.get("DEF-ENUM")?.value).toBe("B");
  });

  it("fails closed on unknown definitions, bad kinds, bad operations, range violations, and duplicate order", () => {
    const definition = [{ capabilityDefinitionId: "DEF", key: "flag", valueKind: "BOOLEAN" as const }];
    const event = { capabilityEventId: "E1", capabilityDefinitionId: "DEF", occurredAt: new Date(0), sequence: 1n, operation: "SET" as const, booleanValue: true };
    expect(() => reduceCapabilityEvents(definition, [{ ...event, capabilityDefinitionId: "UNKNOWN" }])).toThrow(/Unknown CapabilityDefinition/);
    expect(() => reduceCapabilityEvents(definition, [{ ...event, booleanValue: null, scoreValue: 1 }])).toThrow(/boolean/);
    expect(() => reduceCapabilityEvents(definition, [{ ...event, operation: "ADD" }])).toThrow(/does not support ADD/);
    expect(() => reduceCapabilityEvents(definition, [event, { ...event }])).toThrow(/Duplicate CapabilityEvent/);
    expect(() => reduceCapabilityEvents(
      [{ capabilityDefinitionId: "DEF", key: "score", valueKind: "SCORE", maxValue: 2 }],
      [{ ...event, booleanValue: null, scoreValue: 3 }],
    )).toThrow(/authored maximum/);
  });

  it("orders by occurredAt, sequence, and event ID and validates counters and references", () => {
    const state = reduceCapabilityEvents([
      { capabilityDefinitionId: "COUNT", key: "count", valueKind: "COUNTER" },
      { capabilityDefinitionId: "REF", key: "place", valueKind: "REFERENCE", allowedReferenceEntityTypes: ["SITE"] },
    ], [
      { capabilityEventId: "B", capabilityDefinitionId: "COUNT", occurredAt: new Date(0), sequence: 0n, operation: "ADD", counterValue: 2n },
      { capabilityEventId: "A", capabilityDefinitionId: "COUNT", occurredAt: new Date(0), sequence: 0n, operation: "SET", counterValue: 3n },
      { capabilityEventId: "R", capabilityDefinitionId: "REF", occurredAt: new Date(1), sequence: 0n, operation: "SET", referenceEntityType: "SITE", referenceEntityId: "SITE-1" },
    ], (reference) => reference.entityId === "SITE-1");
    expect(state.get("COUNT")?.value).toBe(5n);
    expect(state.get("REF")?.value).toEqual({ entityType: "SITE", entityId: "SITE-1" });
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
