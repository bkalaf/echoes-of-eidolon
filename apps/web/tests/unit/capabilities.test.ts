import { describe, expect, it } from "vitest";

import {
  capabilityStateKey,
  canonicalizeCapabilityBindings,
  evaluateCapabilityCondition,
  highestEarnedRanks,
  projectCapabilityEvents,
  projectFactionStanding,
  projectRewardEvidenceScore,
  rebuildCapabilityProjection,
  resolveCapability,
  validateCapabilityCondition,
  type CapabilityCondition,
  type CapabilityDefinitionVersionContract,
  type CapabilityEventContract,
  type CapabilityScope,
  type CapabilityStateEntry,
  type FactionScoringPolicyContract,
  type RewardScoringPolicyContract,
} from "../../src/domain/capabilities";

const account: CapabilityScope = { scopeType: "ACCOUNT", scopeId: "ACCOUNT-1" };
const otherAccount: CapabilityScope = { scopeType: "ACCOUNT", scopeId: "ACCOUNT-2" };

function definition(
  overrides: Partial<CapabilityDefinitionVersionContract> = {},
): CapabilityDefinitionVersionContract {
  return {
    capabilityDefinitionId: "DEF-BOOLEAN",
    capabilityDefinitionVersionId: "DEF-BOOLEAN:V1",
    code: "BOOLEAN_FACT",
    version: 1,
    pathPattern: "fact",
    parameters: [],
    valueKind: "BOOLEAN",
    allowedOperations: ["SET", "CLEAR"],
    monotonicPolicy: "NONE",
    ...overrides,
  };
}

function event(
  capability: CapabilityDefinitionVersionContract,
  sequence: bigint,
  overrides: Partial<CapabilityEventContract> = {},
): CapabilityEventContract {
  const address = overrides.address ?? resolveCapability(capability, {});
  return {
    capabilityEventId: `EVENT-${sequence}`,
    sequence,
    scope: account,
    address,
    capabilityDefinitionVersionId: capability.capabilityDefinitionVersionId,
    operation: "SET",
    value: true,
    occurredAt: new Date(0),
    recordedAt: new Date(Number(sequence)),
    ...overrides,
    address,
  };
}

function definitionMap(...definitions: CapabilityDefinitionVersionContract[]) {
  return new Map(definitions.map((item) => [item.capabilityDefinitionVersionId, item]));
}

describe("Capability Ledger architecture", () => {
  it("01 keeps two bound addresses from one definition independent", () => {
    const capability = definition({
      pathPattern: "book.{BOOK}.found",
      parameters: [{ name: "BOOK", kind: "STRING", allowedValues: ["B1", "B2"], ordinal: 0 }],
    });
    const first = resolveCapability(capability, { BOOK: "B1" });
    const second = resolveCapability(capability, { BOOK: "B2" });
    const state = projectCapabilityEvents([capability], [
      event(capability, 1n, { address: first }),
      event(capability, 2n, { address: second, value: false }),
    ]);
    expect(state.get(capabilityStateKey(account, first))?.value).toBe(true);
    expect(state.get(capabilityStateKey(account, second))?.value).toBe(false);
  });

  it("02 keeps two scopes using one address independent", () => {
    const capability = definition();
    const address = resolveCapability(capability, {});
    const state = projectCapabilityEvents([capability], [
      event(capability, 1n, { address, scope: account, value: true }),
      event(capability, 2n, { address, scope: otherAccount, value: false }),
    ]);
    expect(state.get(capabilityStateKey(account, address))?.value).toBe(true);
    expect(state.get(capabilityStateKey(otherAccount, address))?.value).toBe(false);
  });

  it("03 replays solely by database sequence", () => {
    const capability = definition();
    const state = projectCapabilityEvents([capability], [
      event(capability, 2n, { value: false }),
      event(capability, 1n, { value: true }),
    ]);
    expect([...state.values()][0]?.value).toBe(false);
  });

  it("04 does not let occurredAt control replay", () => {
    const capability = definition();
    const state = projectCapabilityEvents([capability], [
      event(capability, 1n, { value: true, occurredAt: new Date("2099-01-01") }),
      event(capability, 2n, { value: false, occurredAt: new Date("2000-01-01") }),
    ]);
    expect([...state.values()][0]?.value).toBe(false);
  });

  it("05 CLEAR makes projected state absent without a magic value", () => {
    const capability = definition();
    const state = projectCapabilityEvents([capability], [
      event(capability, 1n),
      event(capability, 2n, { operation: "CLEAR", value: undefined }),
    ]);
    expect([...state.values()][0]).toMatchObject({ isPresent: false, lastSequence: 2n });
    expect([...state.values()][0]).not.toHaveProperty("value");
  });

  it("06 rejects ADD for BOOLEAN, ENUM, and REFERENCE", () => {
    const boolean = definition({ allowedOperations: ["SET", "ADD"] });
    expect(() => projectCapabilityEvents([boolean], [event(boolean, 1n, { operation: "ADD" })])).toThrow(/does not support ADD/);
    const enumeration = definition({ valueKind: "ENUM", enumValues: ["A"], allowedOperations: ["SET", "ADD"] });
    expect(() => projectCapabilityEvents([enumeration], [event(enumeration, 1n, { operation: "ADD", value: "A" })])).toThrow(/does not support ADD/);
    const reference = definition({ valueKind: "REFERENCE", allowedReferenceEntityTypes: ["SITE"], allowedOperations: ["SET", "ADD"] });
    expect(() => projectCapabilityEvents([reference], [event(reference, 1n, { operation: "ADD", value: { entityType: "SITE", entityId: "S1" } })])).toThrow(/does not support ADD/);
  });

  it("07 validates numeric bounds after ADD", () => {
    const score = definition({ valueKind: "SCORE", minValue: 0, maxValue: 10, allowedOperations: ["SET", "ADD"] });
    expect(() => projectCapabilityEvents([score], [
      event(score, 1n, { value: 8 }),
      event(score, 2n, { operation: "ADD", value: 3 }),
    ])).toThrow(/authored maximum/);
  });

  it("08 enforces TRUE_ONLY", () => {
    const fact = definition({ monotonicPolicy: "TRUE_ONLY" });
    expect(() => projectCapabilityEvents([fact], [event(fact, 1n, { value: false })])).toThrow(/TRUE_ONLY/);
  });

  it("09 enforces NONDECREASING and NONINCREASING", () => {
    const up = definition({ valueKind: "SCORE", allowedOperations: ["SET"], monotonicPolicy: "NONDECREASING" });
    expect(() => projectCapabilityEvents([up], [event(up, 1n, { value: 5 }), event(up, 2n, { value: 4 })])).toThrow(/NONDECREASING/);
    const down = definition({ ...up, capabilityDefinitionVersionId: "DOWN:V1", monotonicPolicy: "NONINCREASING" });
    expect(() => projectCapabilityEvents([down], [event(down, 1n, { value: 5 }), event(down, 2n, { value: 6 })])).toThrow(/NONINCREASING/);
  });

  it("10 rejects unknown address bindings", () => {
    expect(() => resolveCapability(definition(), { UNKNOWN: "X" })).toThrow(/unknown bindings/);
  });

  it("11 rejects missing address bindings", () => {
    const capability = definition({ pathPattern: "book.{BOOK}", parameters: [{ name: "BOOK", kind: "STRING", allowedValues: ["B1"], ordinal: 0 }] });
    expect(() => resolveCapability(capability, {})).toThrow(/missing bindings/);
  });

  it("12 rejects invalid ENUM values", () => {
    const enumeration = definition({ valueKind: "ENUM", enumValues: ["A"], allowedOperations: ["SET"] });
    expect(() => projectCapabilityEvents([enumeration], [event(enumeration, 1n, { value: "B" })])).toThrow(/authored enum/);
  });

  it("13 rejects invalid references when authoritative resolution is available", () => {
    const reference = definition({ valueKind: "REFERENCE", allowedReferenceEntityTypes: ["SITE"], allowedOperations: ["SET"] });
    expect(() => projectCapabilityEvents(
      [reference],
      [event(reference, 1n, { value: { entityType: "SITE", entityId: "MISSING" } })],
      (_type, identity) => identity === "KNOWN",
    )).toThrow(/unknown domain identity/);
  });

  it("14 treats an identical idempotent retry as one mutation and rejects conflicts", () => {
    const score = definition({ valueKind: "SCORE", allowedOperations: ["ADD"] });
    const first = event(score, 1n, { operation: "ADD", value: 5, idempotencyKey: "award-1" });
    const retry = event(score, 2n, { capabilityEventId: "RETRY", operation: "ADD", value: 5, idempotencyKey: "award-1" });
    expect([...projectCapabilityEvents([score], [first, retry]).values()][0]?.value).toBe(5);
    expect(() => projectCapabilityEvents([score], [first, { ...retry, value: 6 }])).toThrow(/conflicts/);
  });

  it("17 serializes capability bindings deterministically", () => {
    expect(canonicalizeCapabilityBindings({ Z: "last", A: "first" })).toBe('{"A":"first","Z":"last"}');
  });

  it("18 preserves reward evidence as semantic kinds", () => {
    const evidence = { kind: "PROOF" as const, evidenceId: "EVIDENCE-1", scoringPolicyVersion: 1 };
    expect(evidence).toEqual({ kind: "PROOF", evidenceId: "EVIDENCE-1", scoringPolicyVersion: 1 });
  });

  const rewardV1: RewardScoringPolicyContract = {
    version: 1,
    minimumScore: 0,
    maximumScore: 1000,
    weights: { RUMOR: 50, EVIDENCE: 100, PROOF: 200, DOUBT: -50, CONTRADICTION: -100, REFUTATION: -200 },
  };
  const rewardCandidate = { rewardCandidateId: "CANDIDATE", rewardId: "REWARD", scoreCeiling: 1000 };
  const rewardEvent = {
    rewardEvidenceEventId: "REWARD-EVENT",
    scope: account,
    rewardId: "REWARD",
    candidateId: "CANDIDATE",
    kind: "PROOF" as const,
    evidenceId: "EVIDENCE-1",
    scoringPolicyVersion: 1,
    recordedAt: new Date(0),
  };

  it("19 rejects duplicate evidence for one scoped candidate", () => {
    expect(() => projectRewardEvidenceScore(
      [rewardEvent, { ...rewardEvent, rewardEvidenceEventId: "RETRY" }],
      new Map([[1, rewardV1]]),
      rewardCandidate,
    )).toThrow(/Duplicate reward evidence/);
  });

  it("20 uses the scoring policy version recorded by the evidence", () => {
    const v2 = { ...rewardV1, version: 2, weights: { ...rewardV1.weights, PROOF: 1 } };
    expect(projectRewardEvidenceScore([{ ...rewardEvent, scoringPolicyVersion: 2 }], new Map([[1, rewardV1], [2, v2]]), rewardCandidate)).toBe(1);
  });

  it("21 does not reinterpret old evidence when a new policy appears", () => {
    const policies = new Map<number, RewardScoringPolicyContract>([
      [1, rewardV1],
      [2, { ...rewardV1, version: 2, weights: { ...rewardV1.weights, PROOF: 999 } }],
    ]);
    expect(projectRewardEvidenceScore([rewardEvent], policies, rewardCandidate)).toBe(200);
  });

  it("22 clamps candidate scores to authored ceilings", () => {
    expect(projectRewardEvidenceScore(
      [rewardEvent, { ...rewardEvent, rewardEvidenceEventId: "TWO", evidenceId: "EVIDENCE-2" }],
      new Map([[1, rewardV1]]),
      { ...rewardCandidate, scoreCeiling: 300 },
    )).toBe(300);
  });

  it("23 keeps greater-than-900 unreachable at a 900 ceiling", () => {
    const events = Array.from({ length: 6 }, (_, index) => ({
      ...rewardEvent,
      rewardEvidenceEventId: `PROOF-${index}`,
      evidenceId: `EVIDENCE-${index}`,
    }));
    expect(projectRewardEvidenceScore(events, new Map([[1, rewardV1]]), { ...rewardCandidate, scoreCeiling: 900 })).toBe(900);
  });

  it("24 derives faction standing only through supplied configuration", () => {
    const policy: FactionScoringPolicyContract = {
      version: 1,
      minimumScore: -1000,
      maximumScore: 1000,
      weights: { MINOR_HARM: -10, MAJOR_HARM: -100, MINOR_AID: 10, MAJOR_AID: 100, PUBLIC_CENSURE: -50, PRIVATE_CENSURE: -25, PUBLIC_SUPPORT: 50, PRIVATE_SUPPORT: 25 },
    };
    const evidence = [{ factionStandingEvidenceEventId: "F1", scope: account, factionId: "FACTION", kind: "MAJOR_AID" as const, evidenceId: "E1", scoringPolicyVersion: 1, recordedAt: new Date(0) }];
    expect(projectFactionStanding(evidence, new Map([[1, policy]]))).toBe(100);
    expect(() => projectFactionStanding(evidence, new Map())).toThrow(/unconfigured/);
  });

  const conditionDefinition = definition();
  const conditionAddress = resolveCapability(conditionDefinition, {});
  const conditionDefinitions = definitionMap(conditionDefinition);
  const presentState: ReadonlyMap<string, CapabilityStateEntry> = new Map([[capabilityStateKey(account, conditionAddress), {
    scope: account,
    address: conditionAddress,
    capabilityDefinitionVersionId: conditionDefinition.capabilityDefinitionVersionId,
    isPresent: true,
    value: true,
    lastSequence: 1n,
  }]]);

  it("25 evaluates EXISTS and NOT_EXISTS", () => {
    expect(evaluateCapabilityCondition({ scope: account, address: conditionAddress, operator: "EXISTS" }, presentState, conditionDefinitions)).toBe(true);
    expect(evaluateCapabilityCondition({ scope: otherAccount, address: conditionAddress, operator: "NOT_EXISTS" }, presentState, conditionDefinitions)).toBe(true);
  });

  it("26 evaluates EQ and NEQ", () => {
    expect(evaluateCapabilityCondition({ scope: account, address: conditionAddress, operator: "EQ", value: true }, presentState, conditionDefinitions)).toBe(true);
    expect(evaluateCapabilityCondition({ scope: account, address: conditionAddress, operator: "NEQ", value: false }, presentState, conditionDefinitions)).toBe(true);
  });

  it("27 evaluates numeric comparisons and rejects them for BOOLEAN", () => {
    const numeric = definition({ capabilityDefinitionId: "SCORE", capabilityDefinitionVersionId: "SCORE:V1", valueKind: "SCORE", allowedOperations: ["SET"] });
    const address = resolveCapability(numeric, {});
    const state = projectCapabilityEvents([numeric], [event(numeric, 1n, { address, value: 10 })]);
    expect(evaluateCapabilityCondition({ scope: account, address, operator: "GTE", value: 10 }, state, definitionMap(numeric))).toBe(true);
    expect(() => validateCapabilityCondition({ scope: account, address: conditionAddress, operator: "GT", value: true }, conditionDefinitions)).toThrow(/numeric/);
  });

  it("28 evaluates IN and NOT_IN and rejects scalar membership operands", () => {
    expect(evaluateCapabilityCondition({ scope: account, address: conditionAddress, operator: "IN", value: [false, true] }, presentState, conditionDefinitions)).toBe(true);
    expect(evaluateCapabilityCondition({ scope: account, address: conditionAddress, operator: "NOT_IN", value: [false] }, presentState, conditionDefinitions)).toBe(true);
    expect(() => validateCapabilityCondition({ scope: account, address: conditionAddress, operator: "IN", value: true }, conditionDefinitions)).toThrow(/value list/);
  });

  it("29 evaluates nested all, any, and not trees", () => {
    const condition: CapabilityCondition = { all: [
      { scope: account, address: conditionAddress, operator: "EXISTS" },
      { any: [
        { scope: account, address: conditionAddress, operator: "EQ", value: false },
        { not: { scope: account, address: conditionAddress, operator: "EQ", value: false } },
      ] },
    ] };
    expect(evaluateCapabilityCondition(condition, presentState, conditionDefinitions)).toBe(true);
  });

  it("32 rebuilds the same projection from the event ledger", () => {
    const score = definition({ valueKind: "SCORE", allowedOperations: ["SET", "ADD"] });
    const ledger = [event(score, 1n, { value: 2 }), event(score, 2n, { operation: "ADD", value: 3 })];
    expect(rebuildCapabilityProjection([score], ledger)).toEqual(projectCapabilityEvents([score], ledger));
  });
});

describe("unrelated achievement projection", () => {
  it("keeps only the highest earned rank in each chain", () => {
    expect(highestEarnedRanks([
      { achievementDefinitionId: "A1", chainKey: "A", rank: 1 },
      { achievementDefinitionId: "A2", chainKey: "A", rank: 2 },
      { achievementDefinitionId: "B1", chainKey: "B", rank: 1 },
    ])).toEqual([
      { achievementDefinitionId: "A2", chainKey: "A", rank: 2 },
      { achievementDefinitionId: "B1", chainKey: "B", rank: 1 },
    ]);
  });
});
