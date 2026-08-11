import type {
  CapabilityMonotonicPolicy,
  CapabilityOperation,
  CapabilityParameterKind,
  CapabilityRequirementOperator,
  CapabilityScopeType,
  CapabilityValueKind,
  EntityType,
  FactionStandingEvidenceKind,
  RewardEvidenceKind,
} from "../generated/prisma/enums";

export type {
  CapabilityMonotonicPolicy,
  CapabilityOperation,
  CapabilityParameterKind,
  CapabilityRequirementOperator,
  CapabilityScopeType,
  CapabilityValueKind,
  FactionStandingEvidenceKind,
  RewardEvidenceKind,
} from "../generated/prisma/enums";

export interface CapabilityReferenceValue {
  entityType: EntityType;
  entityId: string;
}

export type CapabilityValue = boolean | number | bigint | string | CapabilityReferenceValue;

export interface CapabilityScope {
  scopeType: CapabilityScopeType;
  scopeId: string;
}

export interface CapabilityParameterContract {
  name: string;
  kind: CapabilityParameterKind;
  entityType?: EntityType | null;
  allowedValues?: readonly string[];
  ordinal: number;
}

export interface CapabilityDefinitionVersionContract {
  capabilityDefinitionId: string;
  capabilityDefinitionVersionId: string;
  code: string;
  version: number;
  pathPattern: string;
  parameters: readonly CapabilityParameterContract[];
  valueKind: CapabilityValueKind;
  minValue?: number | null;
  maxValue?: number | null;
  enumValues?: readonly string[];
  allowedReferenceEntityTypes?: readonly EntityType[];
  allowedOperations: readonly CapabilityOperation[];
  monotonicPolicy: CapabilityMonotonicPolicy;
  initialValue?: CapabilityValue;
}

export interface CapabilityAddress {
  capabilityDefinitionId: string;
  bindings: Readonly<Record<string, string>>;
}

export interface ResolvedCapabilityAddress extends CapabilityAddress {
  capabilityDefinitionVersionId: string;
  canonicalBindings: string;
  serializedPath: string;
}

export interface CapabilityGrant {
  address: ResolvedCapabilityAddress;
  operation: CapabilityOperation;
  value?: CapabilityValue;
}

export interface CapabilityEventContract extends CapabilityGrant {
  capabilityEventId: string;
  sequence: bigint;
  scope: CapabilityScope;
  capabilityDefinitionVersionId: string;
  idempotencyKey?: string;
  occurredAt: Date;
  recordedAt: Date;
}

export interface CapabilityStateEntry {
  scope: CapabilityScope;
  address: ResolvedCapabilityAddress;
  capabilityDefinitionVersionId: string;
  isPresent: boolean;
  value?: CapabilityValue;
  lastSequence: bigint;
}

export type CapabilityRequirementValue = CapabilityValue | readonly CapabilityValue[];

export interface CapabilityRequirement {
  scope: CapabilityScope;
  address: ResolvedCapabilityAddress;
  operator: CapabilityRequirementOperator;
  value?: CapabilityRequirementValue;
}

export type CapabilityCondition =
  | CapabilityRequirement
  | { all: readonly CapabilityCondition[] }
  | { any: readonly CapabilityCondition[] }
  | { not: CapabilityCondition };

type EntityExists = (entityType: EntityType, entityId: string) => boolean;

function requireNonempty(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} must be nonempty.`);
}

function sortedParameters(definition: CapabilityDefinitionVersionContract): CapabilityParameterContract[] {
  const parameters = [...definition.parameters].sort((left, right) => left.ordinal - right.ordinal);
  const names = new Set<string>();
  for (const [index, parameter] of parameters.entries()) {
    requireNonempty(parameter.name, "Capability parameter name");
    if (!/^[A-Z][A-Z0-9_]*$/.test(parameter.name)) {
      throw new Error(`Capability ${definition.code} parameter ${parameter.name} is not a canonical parameter name.`);
    }
    if (parameter.ordinal !== index) throw new Error(`Capability ${definition.code} parameter ordinals must be contiguous.`);
    if (names.has(parameter.name)) throw new Error(`Capability ${definition.code} duplicates parameter ${parameter.name}.`);
    if (parameter.kind === "ENTITY") {
      if (!parameter.entityType || (parameter.allowedValues?.length ?? 0) > 0) {
        throw new Error(`Capability ENTITY parameter ${parameter.name} requires one entity type and no string values.`);
      }
    } else if (parameter.entityType || !parameter.allowedValues?.length) {
      throw new Error(`Capability STRING parameter ${parameter.name} requires authored values and no entity type.`);
    }
    names.add(parameter.name);
  }
  return parameters;
}

export function validateCapabilityDefinitionVersion(
  definition: CapabilityDefinitionVersionContract,
  description: string,
): void {
  requireNonempty(definition.capabilityDefinitionId, "Capability definition identity");
  requireNonempty(definition.capabilityDefinitionVersionId, "Capability definition version identity");
  requireNonempty(definition.code, "Capability definition code");
  if (!/^[A-Z][A-Z0-9_]*$/.test(definition.code)) throw new Error("Capability code must use canonical upper snake case.");
  requireNonempty(definition.pathPattern, `Capability ${definition.code} path pattern`);
  requireNonempty(description, `Capability ${definition.code} description`);
  if (!Number.isInteger(definition.version) || definition.version < 1) throw new Error("Capability version must be a positive integer.");

  const parameters = sortedParameters(definition);
  const placeholders = [...definition.pathPattern.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  if (new Set(placeholders).size !== placeholders.length
    || JSON.stringify([...placeholders].sort()) !== JSON.stringify(parameters.map(({ name }) => name).sort())) {
    throw new Error(`Capability ${definition.code} path parameters must exactly match its parameter definitions.`);
  }
  if (definition.allowedOperations.length === 0 || new Set(definition.allowedOperations).size !== definition.allowedOperations.length) {
    throw new Error(`Capability ${definition.code} requires unique allowed operations.`);
  }
  if (definition.allowedOperations.includes("ADD") && !["SCORE", "COUNTER"].includes(definition.valueKind)) {
    throw new Error(`Capability ${definition.code} permits ADD only for SCORE or COUNTER.`);
  }
  const enumValues = definition.enumValues ?? [];
  if ((definition.valueKind === "ENUM") !== (enumValues.length > 0)) {
    throw new Error(`Capability ${definition.code} enum values do not match its value kind.`);
  }
  if (new Set(enumValues).size !== enumValues.length || enumValues.some((value) => !value.trim())) {
    throw new Error(`Capability ${definition.code} enum values must be unique and nonempty.`);
  }
  const referenceTypes = definition.allowedReferenceEntityTypes ?? [];
  if ((definition.valueKind === "REFERENCE") !== (referenceTypes.length > 0)) {
    throw new Error(`Capability ${definition.code} reference types do not match its value kind.`);
  }
  if (new Set(referenceTypes).size !== referenceTypes.length) {
    throw new Error(`Capability ${definition.code} reference entity types must be unique.`);
  }
  const numeric = definition.valueKind === "SCORE" || definition.valueKind === "COUNTER";
  if (!numeric && (definition.minValue != null || definition.maxValue != null)) {
    throw new Error(`Capability ${definition.code} permits bounds only for numeric values.`);
  }
  for (const bound of [definition.minValue, definition.maxValue]) {
    if (bound != null && !Number.isFinite(bound)) throw new Error(`Capability ${definition.code} bounds must be finite.`);
  }
  if (definition.minValue != null && definition.maxValue != null && definition.minValue > definition.maxValue) {
    throw new Error(`Capability ${definition.code} minimum exceeds its maximum.`);
  }
  if (definition.initialValue !== undefined) {
    validateCapabilityValue(definition, definition.initialValue);
    assertRange(definition, definition.initialValue);
  }
}

export function canonicalizeCapabilityBindings(bindings: Readonly<Record<string, string>>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(bindings).sort(([left], [right]) => left.localeCompare(right))));
}

export function resolveCapability(
  definition: CapabilityDefinitionVersionContract,
  bindings: Readonly<Record<string, string>>,
  entityExists?: EntityExists,
): ResolvedCapabilityAddress {
  requireNonempty(definition.capabilityDefinitionId, "Capability definition identity");
  requireNonempty(definition.capabilityDefinitionVersionId, "Capability definition version identity");
  requireNonempty(definition.code, "Capability definition code");
  requireNonempty(definition.pathPattern, `Capability ${definition.code} path pattern`);

  const parameters = sortedParameters(definition);
  const expected = new Set(parameters.map((parameter) => parameter.name));
  const supplied = Object.keys(bindings);
  const unknown = supplied.filter((name) => !expected.has(name));
  if (unknown.length > 0) throw new Error(`Capability ${definition.code} received unknown bindings: ${unknown.sort().join(", ")}.`);
  const missing = parameters.filter((parameter) => !(parameter.name in bindings));
  if (missing.length > 0) throw new Error(`Capability ${definition.code} is missing bindings: ${missing.map(({ name }) => name).join(", ")}.`);

  const normalized: Record<string, string> = {};
  let serializedPath = definition.pathPattern;
  for (const parameter of parameters) {
    const value = bindings[parameter.name] ?? "";
    requireNonempty(value, `Capability binding ${parameter.name}`);
    if (parameter.kind === "STRING") {
      if (!parameter.allowedValues?.includes(value)) {
        throw new Error(`Capability binding ${parameter.name} is not an authored STRING value.`);
      }
    } else {
      if (!parameter.entityType) throw new Error(`Capability ENTITY binding ${parameter.name} lacks an entity type.`);
      if (!entityExists || !entityExists(parameter.entityType, value)) {
        throw new Error(`Capability binding ${parameter.name} references an unknown ${parameter.entityType} identity.`);
      }
    }
    normalized[parameter.name] = value;
    serializedPath = serializedPath.replaceAll(`{${parameter.name}}`, value);
  }
  if (/\{[A-Z][A-Z0-9_]*\}/.test(serializedPath)) {
    throw new Error(`Capability ${definition.code} path pattern contains an unbound parameter.`);
  }

  return {
    capabilityDefinitionId: definition.capabilityDefinitionId,
    capabilityDefinitionVersionId: definition.capabilityDefinitionVersionId,
    bindings: normalized,
    canonicalBindings: canonicalizeCapabilityBindings(normalized),
    serializedPath,
  };
}

function referenceEquals(left: CapabilityReferenceValue, right: CapabilityReferenceValue): boolean {
  return left.entityType === right.entityType && left.entityId === right.entityId;
}

function capabilityValueEquals(left: CapabilityValue, right: CapabilityValue): boolean {
  if (typeof left === "object" && typeof right === "object") return referenceEquals(left, right);
  return left === right;
}

function validateFinite(value: number, code: string): void {
  if (!Number.isFinite(value)) throw new Error(`Capability ${code} requires a finite number.`);
}

export function validateCapabilityValue(
  definition: CapabilityDefinitionVersionContract,
  value: CapabilityValue,
  referenceExists?: EntityExists,
): void {
  if (definition.valueKind === "BOOLEAN") {
    if (typeof value !== "boolean") throw new Error(`Capability ${definition.code} requires a boolean value.`);
    return;
  }
  if (definition.valueKind === "SCORE") {
    if (typeof value !== "number") throw new Error(`Capability ${definition.code} requires a numeric score.`);
    validateFinite(value, definition.code);
    return;
  }
  if (definition.valueKind === "COUNTER") {
    if (typeof value !== "bigint") throw new Error(`Capability ${definition.code} requires an integer counter.`);
    return;
  }
  if (definition.valueKind === "ENUM") {
    if (typeof value !== "string" || !definition.enumValues?.includes(value)) {
      throw new Error(`Capability ${definition.code} requires an authored enum value.`);
    }
    return;
  }
  if (typeof value !== "object" || value === null || !("entityType" in value) || !("entityId" in value)) {
    throw new Error(`Capability ${definition.code} requires a typed reference.`);
  }
  requireNonempty(value.entityId, `Capability ${definition.code} reference identity`);
  if (!definition.allowedReferenceEntityTypes?.includes(value.entityType)) {
    throw new Error(`Capability ${definition.code} received a disallowed reference entity type.`);
  }
  if (referenceExists && !referenceExists(value.entityType, value.entityId)) {
    throw new Error(`Capability ${definition.code} references an unknown domain identity.`);
  }
}

function assertRange(definition: CapabilityDefinitionVersionContract, value: CapabilityValue): void {
  if (typeof value !== "number" && typeof value !== "bigint") return;
  const numeric = typeof value === "bigint" ? Number(value) : value;
  if (definition.minValue != null && numeric < definition.minValue) {
    throw new Error(`Capability ${definition.code} is below its authored minimum.`);
  }
  if (definition.maxValue != null && numeric > definition.maxValue) {
    throw new Error(`Capability ${definition.code} exceeds its authored maximum.`);
  }
}

export function capabilityStateKey(scope: CapabilityScope, address: CapabilityAddress): string {
  requireNonempty(scope.scopeId, "Capability scope identity");
  return `${scope.scopeType}:${scope.scopeId}:${address.capabilityDefinitionId}:${canonicalizeCapabilityBindings(address.bindings)}`;
}

function applyMonotonicPolicy(
  definition: CapabilityDefinitionVersionContract,
  previous: CapabilityValue | undefined,
  next: CapabilityValue,
): void {
  if (definition.monotonicPolicy === "NONE") return;
  if (definition.monotonicPolicy === "TRUE_ONLY") {
    if (next !== true) throw new Error(`Capability ${definition.code} is TRUE_ONLY.`);
    return;
  }
  if (previous === undefined) return;
  const decreases = typeof previous === "number" && typeof next === "number"
    ? next < previous
    : typeof previous === "bigint" && typeof next === "bigint"
      ? next < previous
      : undefined;
  if (decreases === undefined) throw new Error(`Capability ${definition.code} has a nonnumeric monotonic policy.`);
  if (definition.monotonicPolicy === "NONDECREASING" && decreases) {
    throw new Error(`Capability ${definition.code} is NONDECREASING.`);
  }
  if (definition.monotonicPolicy === "NONINCREASING" && !decreases && !capabilityValueEquals(previous, next)) {
    throw new Error(`Capability ${definition.code} is NONINCREASING.`);
  }
}

function idempotencyIdentity(event: CapabilityEventContract): string | undefined {
  return event.idempotencyKey
    ? `${capabilityStateKey(event.scope, event.address)}:${event.idempotencyKey}`
    : undefined;
}

function eventSemanticFingerprint(event: CapabilityEventContract): string {
  const value = typeof event.value === "bigint" ? `${event.value}n` : event.value;
  return JSON.stringify({ operation: event.operation, value });
}

export function projectCapabilityEvents(
  definitions: readonly CapabilityDefinitionVersionContract[],
  events: readonly CapabilityEventContract[],
  entityExists?: EntityExists,
): Map<string, CapabilityStateEntry> {
  const definitionsByVersion = new Map(definitions.map((definition) => [definition.capabilityDefinitionVersionId, definition]));
  const state = new Map<string, CapabilityStateEntry>();
  const eventIds = new Set<string>();
  const sequences = new Set<bigint>();
  const idempotency = new Map<string, string>();

  for (const event of [...events].sort((left, right) => left.sequence < right.sequence ? -1 : left.sequence > right.sequence ? 1 : 0)) {
    if (eventIds.has(event.capabilityEventId)) throw new Error(`Duplicate CapabilityEvent ${event.capabilityEventId}.`);
    if (sequences.has(event.sequence)) throw new Error(`Duplicate CapabilityEvent sequence ${event.sequence}.`);
    eventIds.add(event.capabilityEventId);
    sequences.add(event.sequence);

    const definition = definitionsByVersion.get(event.capabilityDefinitionVersionId);
    if (!definition) throw new Error(`Unknown CapabilityDefinitionVersion ${event.capabilityDefinitionVersionId}.`);
    if (event.address.capabilityDefinitionId !== definition.capabilityDefinitionId
      || event.address.capabilityDefinitionVersionId !== definition.capabilityDefinitionVersionId) {
      throw new Error(`CapabilityEvent ${event.capabilityEventId} uses an address from another definition version.`);
    }
    const resolved = resolveCapability(definition, event.address.bindings, entityExists);
    if (resolved.canonicalBindings !== event.address.canonicalBindings || resolved.serializedPath !== event.address.serializedPath) {
      throw new Error(`CapabilityEvent ${event.capabilityEventId} contains a noncanonical address.`);
    }
    if (!definition.allowedOperations.includes(event.operation)) {
      throw new Error(`Capability ${definition.code} does not allow ${event.operation}.`);
    }

    const idempotencyKey = idempotencyIdentity(event);
    if (idempotencyKey) {
      const fingerprint = eventSemanticFingerprint(event);
      const prior = idempotency.get(idempotencyKey);
      if (prior) {
        if (prior !== fingerprint) throw new Error(`Capability idempotency key ${event.idempotencyKey} conflicts with an earlier event.`);
        continue;
      }
      idempotency.set(idempotencyKey, fingerprint);
    }

    const stateKey = capabilityStateKey(event.scope, resolved);
    const previousEntry = state.get(stateKey);
    const previous = previousEntry?.isPresent ? previousEntry.value : undefined;
    if (event.operation === "CLEAR") {
      if (event.value !== undefined) throw new Error(`Capability ${definition.code} CLEAR cannot carry a value.`);
      state.set(stateKey, {
        scope: event.scope,
        address: resolved,
        capabilityDefinitionVersionId: definition.capabilityDefinitionVersionId,
        isPresent: false,
        lastSequence: event.sequence,
      });
      continue;
    }
    if (event.value === undefined) throw new Error(`Capability ${definition.code} ${event.operation} requires a value.`);
    validateCapabilityValue(definition, event.value, entityExists);

    let next = event.value;
    if (event.operation === "ADD") {
      if (definition.valueKind === "SCORE") {
        const starting = previous ?? definition.initialValue ?? 0;
        if (typeof starting !== "number" || typeof event.value !== "number") {
          throw new Error(`Capability ${definition.code} ADD requires numeric SCORE state.`);
        }
        next = starting + event.value;
      } else if (definition.valueKind === "COUNTER") {
        const starting = previous ?? definition.initialValue ?? 0n;
        if (typeof starting !== "bigint" || typeof event.value !== "bigint") {
          throw new Error(`Capability ${definition.code} ADD requires integer COUNTER state.`);
        }
        next = starting + event.value;
      } else {
        throw new Error(`Capability ${definition.code} does not support ADD.`);
      }
    }
    validateCapabilityValue(definition, next, entityExists);
    assertRange(definition, next);
    applyMonotonicPolicy(definition, previous, next);
    state.set(stateKey, {
      scope: event.scope,
      address: resolved,
      capabilityDefinitionVersionId: definition.capabilityDefinitionVersionId,
      isPresent: true,
      value: next,
      lastSequence: event.sequence,
    });
  }
  return state;
}

export const rebuildCapabilityProjection = projectCapabilityEvents;

function isRequirement(condition: CapabilityCondition): condition is CapabilityRequirement {
  return "operator" in condition;
}

function validateRequirement(
  requirement: CapabilityRequirement,
  definition: CapabilityDefinitionVersionContract,
): void {
  const { operator, value } = requirement;
  if (operator === "EXISTS" || operator === "NOT_EXISTS") {
    if (value !== undefined) throw new Error(`${operator} cannot carry a comparison value.`);
    return;
  }
  if (operator === "IN" || operator === "NOT_IN") {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`${operator} requires a nonempty value list.`);
    for (const member of value) validateCapabilityValue(definition, member);
    return;
  }
  if (value === undefined || Array.isArray(value)) throw new Error(`${operator} requires one comparison value.`);
  validateCapabilityValue(definition, value as CapabilityValue);
  if (["GT", "GTE", "LT", "LTE"].includes(operator) && !["SCORE", "COUNTER"].includes(definition.valueKind)) {
    throw new Error(`${operator} requires a numeric capability definition.`);
  }
}

export function validateCapabilityCondition(
  condition: CapabilityCondition,
  definitions: ReadonlyMap<string, CapabilityDefinitionVersionContract>,
): void {
  if (isRequirement(condition)) {
    const definition = definitions.get(condition.address.capabilityDefinitionVersionId);
    if (!definition) throw new Error(`Unknown CapabilityDefinitionVersion ${condition.address.capabilityDefinitionVersionId}.`);
    validateRequirement(condition, definition);
    return;
  }
  if ("all" in condition || "any" in condition) {
    const children = "all" in condition ? condition.all : condition.any;
    if (children.length === 0) throw new Error("Capability condition groups cannot be empty.");
    for (const child of children) validateCapabilityCondition(child, definitions);
    return;
  }
  if (!("not" in condition) || !condition.not) throw new Error("Invalid capability condition node.");
  validateCapabilityCondition(condition.not, definitions);
}

function compareNumeric(actual: number | bigint, expected: CapabilityValue, operator: CapabilityRequirementOperator): boolean {
  if (typeof actual !== typeof expected || (typeof expected !== "number" && typeof expected !== "bigint")) {
    throw new Error(`${operator} requires matching numeric capability values.`);
  }
  if (operator === "GT") return actual > expected;
  if (operator === "GTE") return actual >= expected;
  if (operator === "LT") return actual < expected;
  return actual <= expected;
}

export function evaluateCapabilityCondition(
  condition: CapabilityCondition,
  state: ReadonlyMap<string, CapabilityStateEntry>,
  definitions: ReadonlyMap<string, CapabilityDefinitionVersionContract>,
): boolean {
  validateCapabilityCondition(condition, definitions);
  if (isRequirement(condition)) {
    const entry = state.get(capabilityStateKey(condition.scope, condition.address));
    const exists = entry?.isPresent === true && entry.value !== undefined;
    if (condition.operator === "EXISTS") return exists;
    if (condition.operator === "NOT_EXISTS") return !exists;
    if (!exists) return false;
    const actual = entry.value!;
    if (condition.operator === "IN" || condition.operator === "NOT_IN") {
      const included = (condition.value as readonly CapabilityValue[]).some((candidate) => capabilityValueEquals(actual, candidate));
      return condition.operator === "IN" ? included : !included;
    }
    const expected = condition.value as CapabilityValue;
    if (condition.operator === "EQ") return capabilityValueEquals(actual, expected);
    if (condition.operator === "NEQ") return !capabilityValueEquals(actual, expected);
    if (typeof actual !== "number" && typeof actual !== "bigint") throw new Error(`${condition.operator} requires numeric state.`);
    return compareNumeric(actual, expected, condition.operator);
  }
  if ("all" in condition) return condition.all.every((child) => evaluateCapabilityCondition(child, state, definitions));
  if ("any" in condition) return condition.any.some((child) => evaluateCapabilityCondition(child, state, definitions));
  return !evaluateCapabilityCondition(condition.not, state, definitions);
}

export interface RewardScoringPolicyContract {
  version: number;
  minimumScore: number;
  maximumScore: number;
  weights: Readonly<Record<RewardEvidenceKind, number>>;
}

export interface RewardCandidateContract {
  rewardCandidateId: string;
  rewardId: string;
  scoreCeiling: number;
}

export interface RewardEvidenceEventContract {
  rewardEvidenceEventId: string;
  scope: CapabilityScope;
  rewardId: string;
  candidateId: string;
  kind: RewardEvidenceKind;
  evidenceId: string;
  scoringPolicyVersion: number;
  recordedAt: Date;
}

export function projectRewardEvidenceScore(
  events: readonly RewardEvidenceEventContract[],
  policies: ReadonlyMap<number, RewardScoringPolicyContract>,
  candidate: RewardCandidateContract,
): number {
  if (!Number.isFinite(candidate.scoreCeiling)) throw new Error("Reward candidate ceiling must be finite.");
  const duplicateEvidence = new Set<string>();
  let score = 0;
  for (const event of [...events].sort((left, right) =>
    left.recordedAt.getTime() - right.recordedAt.getTime()
      || left.rewardEvidenceEventId.localeCompare(right.rewardEvidenceEventId))) {
    if (event.rewardId !== candidate.rewardId || event.candidateId !== candidate.rewardCandidateId) continue;
    const evidenceIdentity = `${event.scope.scopeType}:${event.scope.scopeId}:${event.candidateId}:${event.evidenceId}`;
    if (duplicateEvidence.has(evidenceIdentity)) throw new Error(`Duplicate reward evidence ${event.evidenceId}.`);
    duplicateEvidence.add(evidenceIdentity);
    const policy = policies.get(event.scoringPolicyVersion);
    if (!policy) throw new Error(`Reward scoring policy version ${event.scoringPolicyVersion} is unavailable.`);
    const weight = policy.weights[event.kind];
    if (!Number.isFinite(weight)) throw new Error(`Reward scoring policy ${policy.version} is missing ${event.kind}.`);
    score = Math.min(Math.max(score + weight, policy.minimumScore), policy.maximumScore, candidate.scoreCeiling);
  }
  return score;
}

export interface FactionScoringPolicyContract {
  version: number;
  minimumScore: number;
  maximumScore: number;
  weights: Readonly<Record<FactionStandingEvidenceKind, number>>;
}

export interface FactionStandingEvidenceEventContract {
  factionStandingEvidenceEventId: string;
  scope: CapabilityScope;
  factionId: string;
  kind: FactionStandingEvidenceKind;
  evidenceId: string;
  scoringPolicyVersion: number;
  recordedAt: Date;
}

export function projectFactionStanding(
  events: readonly FactionStandingEvidenceEventContract[],
  policies: ReadonlyMap<number, FactionScoringPolicyContract>,
): number {
  const duplicateEvidence = new Set<string>();
  let score = 0;
  for (const event of [...events].sort((left, right) =>
    left.recordedAt.getTime() - right.recordedAt.getTime()
      || left.factionStandingEvidenceEventId.localeCompare(right.factionStandingEvidenceEventId))) {
    const evidenceIdentity = `${event.scope.scopeType}:${event.scope.scopeId}:${event.factionId}:${event.evidenceId}`;
    if (duplicateEvidence.has(evidenceIdentity)) throw new Error(`Duplicate faction evidence ${event.evidenceId}.`);
    duplicateEvidence.add(evidenceIdentity);
    const policy = policies.get(event.scoringPolicyVersion);
    if (!policy) throw new Error(`Faction scoring policy version ${event.scoringPolicyVersion} is unconfigured.`);
    const weight = policy.weights[event.kind];
    if (!Number.isFinite(weight)) throw new Error(`Faction scoring policy ${policy.version} is missing ${event.kind}.`);
    score = Math.min(Math.max(score + weight, policy.minimumScore), policy.maximumScore);
  }
  return score;
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
