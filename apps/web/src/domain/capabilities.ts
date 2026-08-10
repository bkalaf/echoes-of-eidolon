import type { CapabilityOperation, CapabilityValueKind, RewardEvidenceKind } from "../generated/prisma/enums";

export type { CapabilityOperation, CapabilityValueKind, RewardEvidenceKind } from "../generated/prisma/enums";
export type CapabilityValue = boolean | number | string;

export interface CapabilityDefinitionContract {
  capabilityDefinitionId: string;
  key: string;
  valueKind: CapabilityValueKind;
  minValue?: number | null;
  maxValue?: number | null;
  enumValues?: readonly string[];
}

export interface CapabilityEventContract {
  capabilityEventId: string;
  capabilityDefinitionId: string;
  sequence: bigint;
  operation: CapabilityOperation;
  value: CapabilityValue;
}

export interface CapabilityStateEntry {
  capabilityDefinitionId: string;
  key: string;
  value: CapabilityValue;
}

function assertFiniteNumber(value: CapabilityValue, definition: CapabilityDefinitionContract): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Capability ${definition.key} requires a finite numeric value.`);
  }
}

function validateValue(value: CapabilityValue, definition: CapabilityDefinitionContract): void {
  if (definition.valueKind === "BOOLEAN") {
    if (typeof value !== "boolean") throw new Error(`Capability ${definition.key} requires a boolean value.`);
    return;
  }
  if (definition.valueKind === "SCORE" || definition.valueKind === "COUNTER") {
    assertFiniteNumber(value, definition);
    return;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Capability ${definition.key} requires a nonempty ${definition.valueKind.toLowerCase()} value.`);
  }
  if (definition.valueKind === "ENUM" && (!definition.enumValues || !definition.enumValues.includes(value))) {
    throw new Error(`Capability ${definition.key} received an unregistered enum value.`);
  }
}

function assertRange(value: CapabilityValue, definition: CapabilityDefinitionContract): void {
  if (typeof value !== "number") return;
  if (definition.minValue != null && value < definition.minValue) {
    throw new Error(`Capability ${definition.key} is below its authored minimum.`);
  }
  if (definition.maxValue != null && value > definition.maxValue) {
    throw new Error(`Capability ${definition.key} exceeds its authored maximum.`);
  }
}

export function reduceCapabilityEvents(
  definitions: readonly CapabilityDefinitionContract[],
  events: readonly CapabilityEventContract[],
): Map<string, CapabilityStateEntry> {
  const definitionById = new Map(definitions.map((definition) => [definition.capabilityDefinitionId, definition]));
  const seenEventIds = new Set<string>();
  const seenSequences = new Set<bigint>();
  const state = new Map<string, CapabilityStateEntry>();

  for (const event of [...events].sort((left, right) => left.sequence < right.sequence ? -1 : left.sequence > right.sequence ? 1 : 0)) {
    if (seenEventIds.has(event.capabilityEventId)) throw new Error(`Duplicate CapabilityEvent ${event.capabilityEventId}.`);
    if (seenSequences.has(event.sequence)) throw new Error(`Duplicate CapabilityEvent sequence ${event.sequence}.`);
    seenEventIds.add(event.capabilityEventId);
    seenSequences.add(event.sequence);

    const definition = definitionById.get(event.capabilityDefinitionId);
    if (!definition) throw new Error(`Unknown CapabilityDefinition ${event.capabilityDefinitionId}.`);
    if (event.operation !== "SET" && event.operation !== "ADD") {
      throw new Error(`Capability ${definition.key} received an unsupported operation.`);
    }
    validateValue(event.value, definition);

    let value = event.value;
    if (event.operation === "ADD") {
      if (definition.valueKind !== "SCORE" && definition.valueKind !== "COUNTER") {
        throw new Error(`Capability ${definition.key} does not support ADD.`);
      }
      assertFiniteNumber(event.value, definition);
      const previous = state.get(definition.capabilityDefinitionId)?.value ?? 0;
      if (typeof previous !== "number") throw new Error(`Capability ${definition.key} has nonnumeric state.`);
      value = previous + event.value;
    }
    assertRange(value, definition);
    state.set(definition.capabilityDefinitionId, {
      capabilityDefinitionId: definition.capabilityDefinitionId,
      key: definition.key,
      value,
    });
  }
  return state;
}

export const rewardEvidenceWeights = {
  RUMOR: 50,
  EVIDENCE: 100,
  PROOF: 200,
  DOUBT: -50,
  CONTRADICTION: -100,
  REFUTATION: -200,
} as const satisfies Record<RewardEvidenceKind, number>;

export function scoreRewardEvidence(kinds: readonly RewardEvidenceKind[], authoredCeiling: number): number {
  if (!Number.isFinite(authoredCeiling)) throw new Error("Reward evidence ceiling must be finite.");
  const score = kinds.reduce((total, kind) => total + rewardEvidenceWeights[kind], 0);
  return Math.min(score, authoredCeiling);
}

export interface EarnedAchievement {
  achievementDefinitionId: string;
  chainKey: string;
  rank: number;
}

export function highestEarnedRanks(earned: readonly EarnedAchievement[]): EarnedAchievement[] {
  const highest = new Map<string, EarnedAchievement>();
  for (const achievement of earned) {
    const current = highest.get(achievement.chainKey);
    if (!current || achievement.rank > current.rank) highest.set(achievement.chainKey, achievement);
  }
  return [...highest.values()];
}
