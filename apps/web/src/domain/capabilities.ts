import type { CapabilityOperation, CapabilityValueKind, EntityType, RewardEvidenceKind } from "../generated/prisma/enums";

export type { CapabilityOperation, CapabilityValueKind, RewardEvidenceKind } from "../generated/prisma/enums";
export interface CapabilityReferenceValue {
  entityType: EntityType;
  entityId: string;
}

export type CapabilityValue = boolean | number | bigint | string | CapabilityReferenceValue;

export interface CapabilityDefinitionContract {
  capabilityDefinitionId: string;
  key: string;
  valueKind: CapabilityValueKind;
  minValue?: number | null;
  maxValue?: number | null;
  enumValues?: readonly string[];
  allowedReferenceEntityTypes?: readonly EntityType[];
}

export interface CapabilityEventContract {
  capabilityEventId: string;
  capabilityDefinitionId: string;
  occurredAt: Date;
  sequence: bigint;
  operation: CapabilityOperation;
  booleanValue?: boolean | null;
  scoreValue?: number | null;
  counterValue?: bigint | null;
  enumValue?: string | null;
  referenceEntityType?: EntityType | null;
  referenceEntityId?: string | null;
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

function eventValue(event: CapabilityEventContract, definition: CapabilityDefinitionContract): CapabilityValue {
  const referencePresent = event.referenceEntityType != null || event.referenceEntityId != null;
  const payloads = [
    event.booleanValue != null,
    event.scoreValue != null,
    event.counterValue != null,
    event.enumValue != null,
    referencePresent,
  ];
  if (payloads.filter(Boolean).length !== 1) {
    throw new Error(`Capability ${definition.key} requires exactly one logical value payload.`);
  }
  if (referencePresent) {
    if (!event.referenceEntityType || !event.referenceEntityId) {
      throw new Error(`Capability ${definition.key} requires both reference fields.`);
    }
    return { entityType: event.referenceEntityType, entityId: event.referenceEntityId };
  }
  return event.booleanValue ?? event.scoreValue ?? event.counterValue ?? event.enumValue!;
}

function validateValue(value: CapabilityValue, definition: CapabilityDefinitionContract): void {
  if (definition.valueKind === "BOOLEAN") {
    if (typeof value !== "boolean") throw new Error(`Capability ${definition.key} requires a boolean value.`);
    return;
  }
  if (definition.valueKind === "SCORE") {
    assertFiniteNumber(value, definition);
    return;
  }
  if (definition.valueKind === "COUNTER") {
    if (typeof value !== "bigint") throw new Error(`Capability ${definition.key} requires an integer counter value.`);
    return;
  }
  if (definition.valueKind === "REFERENCE") {
    if (typeof value !== "object" || value === null || !("entityType" in value) || !("entityId" in value)) {
      throw new Error(`Capability ${definition.key} requires a reference value.`);
    }
    if (!definition.allowedReferenceEntityTypes?.includes(value.entityType)) {
      throw new Error(`Capability ${definition.key} received a disallowed reference entity type.`);
    }
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
  if (typeof value !== "number" && typeof value !== "bigint") return;
  const numeric = typeof value === "bigint" ? Number(value) : value;
  if (definition.minValue != null && numeric < definition.minValue) {
    throw new Error(`Capability ${definition.key} is below its authored minimum.`);
  }
  if (definition.maxValue != null && numeric > definition.maxValue) {
    throw new Error(`Capability ${definition.key} exceeds its authored maximum.`);
  }
}

export function reduceCapabilityEvents(
  definitions: readonly CapabilityDefinitionContract[],
  events: readonly CapabilityEventContract[],
  referenceExists: (reference: CapabilityReferenceValue) => boolean = () => true,
): Map<string, CapabilityStateEntry> {
  const definitionById = new Map(definitions.map((definition) => [definition.capabilityDefinitionId, definition]));
  const seenEventIds = new Set<string>();
  const state = new Map<string, CapabilityStateEntry>();

  for (const event of [...events].sort((left, right) =>
    left.occurredAt.getTime() - right.occurredAt.getTime()
      || (left.sequence < right.sequence ? -1 : left.sequence > right.sequence ? 1 : 0)
      || left.capabilityEventId.localeCompare(right.capabilityEventId))) {
    if (seenEventIds.has(event.capabilityEventId)) throw new Error(`Duplicate CapabilityEvent ${event.capabilityEventId}.`);
    seenEventIds.add(event.capabilityEventId);

    const definition = definitionById.get(event.capabilityDefinitionId);
    if (!definition) throw new Error(`Unknown CapabilityDefinition ${event.capabilityDefinitionId}.`);
    if (event.operation !== "SET" && event.operation !== "ADD") {
      throw new Error(`Capability ${definition.key} received an unsupported operation.`);
    }
    const payload = eventValue(event, definition);
    validateValue(payload, definition);
    if (definition.valueKind === "REFERENCE" && !referenceExists(payload as CapabilityReferenceValue)) {
      throw new Error(`Capability ${definition.key} references an unknown domain identity.`);
    }

    let value = payload;
    if (event.operation === "ADD") {
      if (definition.valueKind !== "SCORE" && definition.valueKind !== "COUNTER") {
        throw new Error(`Capability ${definition.key} does not support ADD.`);
      }
      const previous = state.get(definition.capabilityDefinitionId)?.value
        ?? (definition.valueKind === "COUNTER" ? 0n : 0);
      if (definition.valueKind === "COUNTER") {
        if (typeof payload !== "bigint" || typeof previous !== "bigint") throw new Error(`Capability ${definition.key} has noninteger state.`);
        value = previous + payload;
      } else {
        assertFiniteNumber(payload, definition);
        if (typeof previous !== "number") throw new Error(`Capability ${definition.key} has nonnumeric state.`);
        value = previous + payload;
      }
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
