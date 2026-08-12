import { createHash, randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "../generated/prisma/client";
import type {
  CapabilityMonotonicPolicy,
  CapabilityOperation,
  CapabilityParameterKind,
  CapabilityScopeType,
  CapabilityValueKind,
  EntityType,
} from "../generated/prisma/enums";
import {
  capabilityStateKey,
  projectCapabilityEvents,
  projectFactionStanding,
  projectRewardEvidenceScore,
  resolveCapability,
  validateCapabilityDefinitionVersion,
  type CapabilityDefinitionVersionContract,
  type CapabilityEventContract,
  type CapabilityReferenceValue,
  type CapabilityValue,
  type FactionScoringPolicyContract,
  type ResolvedCapabilityAddress,
  type RewardScoringPolicyContract,
} from "../domain/capabilities";
import type { FactionStandingEvidenceKind, RewardEvidenceKind } from "../generated/prisma/enums";
import { getDatabase } from "./database";

type Transaction = Prisma.TransactionClient;

export type CapabilityEntityResolver = (
  entityType: EntityType,
  entityId: string,
  transaction: Transaction,
) => Promise<boolean>;

export interface CapabilityMutationInput {
  scopeType: CapabilityScopeType;
  scopeId: string;
  code: string;
  version: number;
  bindings: Record<string, string>;
  operation: CapabilityOperation;
  value?: CapabilityValue;
  sourceEntityType?: EntityType;
  sourceEntityId?: string;
  idempotencyKey?: string;
  correlationId?: string;
  causationId?: string;
  occurredAt: Date;
}

export interface CapabilityVersionAuthoringInput {
  capabilityDefinitionId?: string;
  code: string;
  pathPattern: string;
  valueKind: CapabilityValueKind;
  minValue?: number | null;
  maxValue?: number | null;
  enumValues?: string[];
  allowedReferenceEntityTypes?: EntityType[];
  allowedOperations: CapabilityOperation[];
  monotonicPolicy: CapabilityMonotonicPolicy;
  initialValue?: CapabilityValue;
  description: string;
  parameters: Array<{
    name: string;
    kind: CapabilityParameterKind;
    entityType?: EntityType | null;
    allowedValues?: string[];
  }>;
}

interface LoadedDefinition {
  contract: CapabilityDefinitionVersionContract;
  rootId: string;
}

function nonempty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be nonempty.`);
  return normalized;
}

function initialValueFromRow(row: {
  initialBoolean: boolean | null;
  initialScore: number | null;
  initialCounter: bigint | null;
  initialEnum: string | null;
  initialReferenceEntityType: EntityType | null;
  initialReferenceEntityId: string | null;
}): CapabilityValue | undefined {
  if (row.initialBoolean != null) return row.initialBoolean;
  if (row.initialScore != null) return row.initialScore;
  if (row.initialCounter != null) return row.initialCounter;
  if (row.initialEnum != null) return row.initialEnum;
  if (row.initialReferenceEntityType && row.initialReferenceEntityId) {
    return { entityType: row.initialReferenceEntityType, entityId: row.initialReferenceEntityId };
  }
  return undefined;
}

async function loadDefinition(
  transaction: Transaction,
  code: string,
  version: number,
): Promise<LoadedDefinition> {
  const root = await transaction.capabilityDefinition.findUnique({
    where: { code },
    include: {
      versions: {
        where: { version },
        include: { parameters: { orderBy: { ordinal: "asc" } } },
      },
    },
  });
  const persisted = root?.versions[0];
  if (!root || !persisted) throw new Error(`Capability ${code} version ${version} does not exist.`);
  if (persisted.status === "DRAFT") throw new Error(`Capability ${code} version ${version} is not published.`);
  const initialValue = initialValueFromRow(persisted);
  return {
    rootId: root.capabilityDefinitionId,
    contract: {
      capabilityDefinitionId: root.capabilityDefinitionId,
      capabilityDefinitionVersionId: persisted.capabilityDefinitionVersionId,
      code: root.code,
      version: persisted.version,
      pathPattern: persisted.pathPattern,
      parameters: persisted.parameters,
      valueKind: persisted.valueKind,
      minValue: persisted.minValue,
      maxValue: persisted.maxValue,
      enumValues: persisted.enumValues,
      allowedReferenceEntityTypes: persisted.allowedReferenceEntityTypes,
      allowedOperations: persisted.allowedOperations,
      monotonicPolicy: persisted.monotonicPolicy,
      ...(initialValue === undefined ? {} : { initialValue }),
    },
  };
}

async function resolveAddress(
  transaction: Transaction,
  definition: LoadedDefinition,
  bindings: Record<string, string>,
  entityResolver?: CapabilityEntityResolver,
): Promise<{ persistedId: string; resolved: ResolvedCapabilityAddress }> {
  const resolvedEntities = new Set<string>();
  for (const parameter of definition.contract.parameters) {
    if (parameter.kind !== "ENTITY") continue;
    const entityId = bindings[parameter.name] ?? "";
    if (!parameter.entityType || !entityResolver
      || !await entityResolver(parameter.entityType, entityId, transaction)) {
      throw new Error(`Capability binding ${parameter.name} does not resolve to an authoritative entity.`);
    }
    resolvedEntities.add(`${parameter.entityType}:${entityId}`);
  }
  const resolved = resolveCapability(
    definition.contract,
    bindings,
    (entityType, entityId) => resolvedEntities.has(`${entityType}:${entityId}`),
  );
  const bindingsHash = createHash("sha256").update(resolved.canonicalBindings).digest("hex");
  const persisted = await transaction.capabilityAddress.upsert({
    where: {
      capabilityDefinitionId_bindingsHash: {
        capabilityDefinitionId: definition.rootId,
        bindingsHash,
      },
    },
    update: {},
    create: {
      capabilityAddressId: randomUUID(),
      capabilityDefinitionId: definition.rootId,
      bindings: { ...resolved.bindings },
      bindingsHash,
    },
  });
  const persistedBindings = JSON.stringify(persisted.bindings);
  if (persistedBindings !== resolved.canonicalBindings) {
    throw new Error(`Capability address hash collision for ${definition.contract.code}.`);
  }
  return { persistedId: persisted.capabilityAddressId, resolved };
}

function typedColumns(operation: CapabilityOperation, value: CapabilityValue | undefined) {
  const empty = {
    booleanValue: null,
    scoreValue: null,
    counterValue: null,
    enumValue: null,
    referenceEntityType: null,
    referenceEntityId: null,
  };
  if (operation === "CLEAR") {
    if (value !== undefined) throw new Error("CLEAR cannot carry a capability value.");
    return empty;
  }
  if (value === undefined) throw new Error(`${operation} requires a capability value.`);
  if (typeof value === "boolean") return { ...empty, booleanValue: value };
  if (typeof value === "number") return { ...empty, scoreValue: value };
  if (typeof value === "bigint") return { ...empty, counterValue: value };
  if (typeof value === "string") return { ...empty, enumValue: value };
  return { ...empty, referenceEntityType: value.entityType, referenceEntityId: value.entityId };
}

function persistedEventValue(event: {
  booleanValue: boolean | null;
  scoreValue: number | null;
  counterValue: bigint | null;
  enumValue: string | null;
  referenceEntityType: EntityType | null;
  referenceEntityId: string | null;
}): CapabilityValue | undefined {
  if (event.booleanValue != null) return event.booleanValue;
  if (event.scoreValue != null) return event.scoreValue;
  if (event.counterValue != null) return event.counterValue;
  if (event.enumValue != null) return event.enumValue;
  if (event.referenceEntityType && event.referenceEntityId) {
    return { entityType: event.referenceEntityType, entityId: event.referenceEntityId };
  }
  return undefined;
}

function valuesEqual(left: CapabilityValue | undefined, right: CapabilityValue | undefined): boolean {
  if (typeof left === "object" && typeof right === "object") {
    return left.entityType === right.entityType && left.entityId === right.entityId;
  }
  return left === right;
}

export async function appendCapabilityEventInTransaction(
  input: CapabilityMutationInput,
  transaction: Transaction,
  entityResolver?: CapabilityEntityResolver,
) {
  nonempty(input.scopeId, "Capability scope identity");
  nonempty(input.code, "Capability code");
  const definition = await loadDefinition(transaction, input.code, input.version);
  const address = await resolveAddress(transaction, definition, input.bindings, entityResolver);
  if (typeof input.value === "object") {
    if (!entityResolver || !await entityResolver(input.value.entityType, input.value.entityId, transaction)) {
      throw new Error("Capability reference value does not resolve to an authoritative entity.");
    }
  }

  if (input.idempotencyKey) {
    const existing = await transaction.capabilityEvent.findUnique({
      where: {
        scopeType_scopeId_capabilityAddressId_idempotencyKey: {
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          capabilityAddressId: address.persistedId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.operation !== input.operation || !valuesEqual(persistedEventValue(existing), input.value)) {
        throw new Error(`Capability idempotency key ${input.idempotencyKey} conflicts with its persisted event.`);
      }
      return { duplicate: true as const, event: existing, address: address.resolved };
    }
  }

  const columns = typedColumns(input.operation, input.value);
  const created = await transaction.capabilityEvent.create({
    data: {
      capabilityEventId: randomUUID(),
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      capabilityAddressId: address.persistedId,
      capabilityDefinitionVersionId: definition.contract.capabilityDefinitionVersionId,
      operation: input.operation,
      ...columns,
      sourceEntityType: input.sourceEntityType ?? null,
      sourceEntityId: input.sourceEntityId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      correlationId: input.correlationId ?? null,
      causationId: input.causationId ?? null,
      occurredAt: input.occurredAt,
    },
  });
  return { duplicate: false as const, event: created, address: address.resolved };
}

export async function appendCapabilityEvent(
  input: CapabilityMutationInput,
  database: PrismaClient = getDatabase(),
  entityResolver?: CapabilityEntityResolver,
) {
  if ((input.sourceEntityType == null) !== (input.sourceEntityId == null)) {
    throw new Error("Capability event source requires both entity type and identity.");
  }
  return database.$transaction(
    (transaction) => appendCapabilityEventInTransaction(input, transaction, entityResolver),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export interface RewardEvidenceMutationInput {
  scopeType: CapabilityScopeType;
  scopeId: string;
  legendaryRewardId: string;
  rewardCandidateId: string;
  kind: RewardEvidenceKind;
  evidenceId: string;
  scoringPolicyVersion: number;
  scoreCapability: Omit<CapabilityMutationInput, "scopeType" | "scopeId" | "operation" | "value" | "idempotencyKey" | "occurredAt">;
  sourceEntityType?: EntityType;
  sourceEntityId?: string;
  occurredAt: Date;
}

export async function appendRewardEvidence(
  input: RewardEvidenceMutationInput,
  database: PrismaClient = getDatabase(),
  entityResolver?: CapabilityEntityResolver,
) {
  return database.$transaction(async (transaction) => {
    const candidate = await transaction.rewardCandidate.findUniqueOrThrow({
      where: { rewardCandidateId: input.rewardCandidateId },
    });
    if (candidate.legendaryRewardId !== input.legendaryRewardId) {
      throw new Error("Reward evidence candidate belongs to another LegendaryReward.");
    }
    const duplicate = await transaction.rewardEvidenceEvent.findUnique({
      where: {
        scopeType_scopeId_rewardCandidateId_evidenceId: {
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          rewardCandidateId: input.rewardCandidateId,
          evidenceId: input.evidenceId,
        },
      },
    });
    if (duplicate) return { duplicate: true as const, evidence: duplicate };

    const evidence = await transaction.rewardEvidenceEvent.create({
      data: {
        rewardEvidenceEventId: randomUUID(),
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        legendaryRewardId: input.legendaryRewardId,
        rewardCandidateId: input.rewardCandidateId,
        kind: input.kind,
        evidenceId: input.evidenceId,
        scoringPolicyVersion: input.scoringPolicyVersion,
        sourceEntityType: input.sourceEntityType ?? null,
        sourceEntityId: input.sourceEntityId ?? null,
        occurredAt: input.occurredAt,
      },
    });
    const ledger = await transaction.rewardEvidenceEvent.findMany({
      where: {
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        rewardCandidateId: input.rewardCandidateId,
      },
      orderBy: [{ recordedAt: "asc" }, { rewardEvidenceEventId: "asc" }],
    });
    const policyVersions = [...new Set(ledger.map((row) => row.scoringPolicyVersion))];
    const persistedPolicies = await transaction.rewardScoringPolicy.findMany({
      where: { version: { in: policyVersions } },
      include: { weights: true },
    });
    const policies = new Map<number, RewardScoringPolicyContract>(persistedPolicies.map((policy) => [policy.version, {
      version: policy.version,
      minimumScore: policy.minimumScore,
      maximumScore: policy.maximumScore,
      weights: Object.fromEntries(policy.weights.map((weight) => [weight.kind, weight.weight])) as Record<RewardEvidenceKind, number>,
    }]));
    const targetScore = projectRewardEvidenceScore(
      ledger.map((row) => ({
        rewardEvidenceEventId: row.rewardEvidenceEventId,
        scope: { scopeType: row.scopeType, scopeId: row.scopeId },
        rewardId: row.legendaryRewardId,
        candidateId: row.rewardCandidateId,
        kind: row.kind,
        evidenceId: row.evidenceId,
        scoringPolicyVersion: row.scoringPolicyVersion,
        recordedAt: row.recordedAt,
      })),
      policies,
      { rewardCandidateId: candidate.rewardCandidateId, rewardId: candidate.legendaryRewardId, scoreCeiling: candidate.scoreCeiling },
    );
    const capability = await appendCapabilityEventInTransaction({
      ...input.scoreCapability,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      operation: "SET",
      value: targetScore,
      idempotencyKey: `reward-evidence:${input.rewardCandidateId}:${input.evidenceId}`,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      occurredAt: input.occurredAt,
    }, transaction, entityResolver);
    return { duplicate: false as const, evidence, capability };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export interface FactionEvidenceMutationInput {
  scopeType: CapabilityScopeType;
  scopeId: string;
  factionId: string;
  kind: FactionStandingEvidenceKind;
  evidenceId: string;
  scoringPolicyVersion: number;
  standingCapability: Omit<CapabilityMutationInput, "scopeType" | "scopeId" | "operation" | "value" | "idempotencyKey" | "occurredAt">;
  sourceEntityType?: EntityType;
  sourceEntityId?: string;
  occurredAt: Date;
}

export async function appendFactionStandingEvidence(
  input: FactionEvidenceMutationInput,
  database: PrismaClient = getDatabase(),
  entityResolver?: CapabilityEntityResolver,
) {
  return database.$transaction(async (transaction) => {
    const policy = await transaction.factionStandingScoringPolicy.findUnique({
      where: { version: input.scoringPolicyVersion },
      include: { weights: true },
    });
    if (!policy || policy.status === "DRAFT" || policy.weights.length === 0) {
      throw new Error(`Faction standing policy version ${input.scoringPolicyVersion} is unconfigured.`);
    }
    const duplicate = await transaction.factionStandingEvidenceEvent.findUnique({
      where: {
        scopeType_scopeId_factionId_evidenceId: {
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          factionId: input.factionId,
          evidenceId: input.evidenceId,
        },
      },
    });
    if (duplicate) return { duplicate: true as const, evidence: duplicate };
    const evidence = await transaction.factionStandingEvidenceEvent.create({
      data: {
        factionStandingEvidenceEventId: randomUUID(),
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        factionId: input.factionId,
        kind: input.kind,
        evidenceId: input.evidenceId,
        scoringPolicyVersion: input.scoringPolicyVersion,
        sourceEntityType: input.sourceEntityType ?? null,
        sourceEntityId: input.sourceEntityId ?? null,
        occurredAt: input.occurredAt,
      },
    });
    const ledger = await transaction.factionStandingEvidenceEvent.findMany({
      where: { scopeType: input.scopeType, scopeId: input.scopeId, factionId: input.factionId },
      orderBy: [{ recordedAt: "asc" }, { factionStandingEvidenceEventId: "asc" }],
    });
    const policyVersions = [...new Set(ledger.map((row) => row.scoringPolicyVersion))];
    const persistedPolicies = await transaction.factionStandingScoringPolicy.findMany({
      where: { version: { in: policyVersions }, status: { not: "DRAFT" } },
      include: { weights: true },
    });
    const policies = new Map<number, FactionScoringPolicyContract>(persistedPolicies.map((item) => [item.version, {
      version: item.version,
      minimumScore: item.minimumScore,
      maximumScore: item.maximumScore,
      weights: Object.fromEntries(item.weights.map((weight) => [weight.kind, weight.weight])) as Record<FactionStandingEvidenceKind, number>,
    }]));
    const targetStanding = projectFactionStanding(ledger.map((row) => ({
      factionStandingEvidenceEventId: row.factionStandingEvidenceEventId,
      scope: { scopeType: row.scopeType, scopeId: row.scopeId },
      factionId: row.factionId,
      kind: row.kind,
      evidenceId: row.evidenceId,
      scoringPolicyVersion: row.scoringPolicyVersion,
      recordedAt: row.recordedAt,
    })), policies);
    const capability = await appendCapabilityEventInTransaction({
      ...input.standingCapability,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      operation: "SET",
      value: targetStanding,
      idempotencyKey: `faction-evidence:${input.factionId}:${input.evidenceId}`,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      occurredAt: input.occurredAt,
    }, transaction, entityResolver);
    return { duplicate: false as const, evidence, capability };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function initialColumns(value: CapabilityValue | undefined) {
  const columns = typedColumns(value === undefined ? "CLEAR" : "SET", value);
  return {
    initialBoolean: columns.booleanValue,
    initialScore: columns.scoreValue,
    initialCounter: columns.counterValue,
    initialEnum: columns.enumValue,
    initialReferenceEntityType: columns.referenceEntityType,
    initialReferenceEntityId: columns.referenceEntityId,
  };
}

export function validateCapabilityVersionAuthoringInput(input: CapabilityVersionAuthoringInput): string {
  const code = nonempty(input.code, "Capability code");
  nonempty(input.pathPattern, "Capability path pattern");
  nonempty(input.description, "Capability description");
  validateCapabilityDefinitionVersion({
    capabilityDefinitionId: input.capabilityDefinitionId ?? "NEW-CAPABILITY",
    capabilityDefinitionVersionId: "NEW-CAPABILITY:v1",
    code,
    version: 1,
    pathPattern: input.pathPattern,
    parameters: input.parameters.map((parameter, ordinal) => ({ ...parameter, ordinal })),
    valueKind: input.valueKind,
    minValue: input.minValue,
    maxValue: input.maxValue,
    enumValues: input.enumValues,
    allowedReferenceEntityTypes: input.allowedReferenceEntityTypes,
    allowedOperations: input.allowedOperations,
    monotonicPolicy: input.monotonicPolicy,
    ...(input.initialValue === undefined ? {} : { initialValue: input.initialValue }),
  }, input.description);
  return code;
}

export async function createCapabilityDefinitionVersionInTransaction(
  input: CapabilityVersionAuthoringInput,
  transaction: Transaction,
) {
  const code = validateCapabilityVersionAuthoringInput(input);
  const existingIdentity = input.capabilityDefinitionId
    ? await transaction.capabilityDefinition.findUnique({ where: { capabilityDefinitionId: input.capabilityDefinitionId } })
    : null;
  if (existingIdentity && existingIdentity.code !== code) {
    throw new Error(`Capability identity ${input.capabilityDefinitionId} belongs to code ${existingIdentity.code}.`);
  }
    const root = await transaction.capabilityDefinition.upsert({
      where: { code },
      update: {},
      create: { capabilityDefinitionId: input.capabilityDefinitionId ?? randomUUID(), code },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (input.capabilityDefinitionId && root.capabilityDefinitionId !== input.capabilityDefinitionId) {
      throw new Error(`Capability code ${code} belongs to another stable identity.`);
    }
    const version = (root.versions[0]?.version ?? 0) + 1;
    const capabilityDefinitionVersionId = `${root.capabilityDefinitionId}:v${version}`;
  return transaction.capabilityDefinitionVersion.create({
      data: {
        capabilityDefinitionVersionId,
        capabilityDefinitionId: root.capabilityDefinitionId,
        version,
        pathPattern: input.pathPattern,
        valueKind: input.valueKind,
        minValue: input.minValue ?? null,
        maxValue: input.maxValue ?? null,
        enumValues: input.enumValues ?? [],
        allowedReferenceEntityTypes: input.allowedReferenceEntityTypes ?? [],
        allowedOperations: input.allowedOperations,
        monotonicPolicy: input.monotonicPolicy,
        ...initialColumns(input.initialValue),
        description: input.description,
        status: "DRAFT",
        parameters: {
          create: input.parameters.map((parameter, ordinal) => ({
            capabilityParameterDefinitionId: `${capabilityDefinitionVersionId}:parameter:${ordinal}`,
            name: parameter.name,
            kind: parameter.kind,
            entityType: parameter.entityType ?? null,
            allowedValues: parameter.allowedValues ?? [],
            ordinal,
          })),
        },
      },
      include: { capabilityDefinition: true, parameters: { orderBy: { ordinal: "asc" } } },
  });
}

export async function createCapabilityDefinitionVersion(
  input: CapabilityVersionAuthoringInput,
  database: PrismaClient = getDatabase(),
) {
  validateCapabilityVersionAuthoringInput(input);
  return database.$transaction(
    (transaction) => createCapabilityDefinitionVersionInTransaction(input, transaction),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function activateCapabilityDefinitionVersion(
  capabilityDefinitionVersionId: string,
  database: PrismaClient = getDatabase(),
) {
  return database.$transaction(async (transaction) => {
    const selected = await transaction.capabilityDefinitionVersion.findUniqueOrThrow({
      where: { capabilityDefinitionVersionId },
    });
    if (selected.status !== "DRAFT") throw new Error("Only a draft capability definition version can be activated.");
    await transaction.capabilityDefinitionVersion.updateMany({
      where: { capabilityDefinitionId: selected.capabilityDefinitionId, status: "ACTIVE" },
      data: { status: "RETIRED" },
    });
    return transaction.capabilityDefinitionVersion.update({
      where: { capabilityDefinitionVersionId },
      data: { status: "ACTIVE" },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listCapabilityDefinitions(database: PrismaClient = getDatabase()) {
  return database.capabilityDefinition.findMany({
    include: {
      versions: {
        include: { parameters: { orderBy: { ordinal: "asc" } } },
        orderBy: { version: "desc" },
      },
    },
    orderBy: { code: "asc" },
  });
}

export async function listCapabilityScoringPolicies(database: PrismaClient = getDatabase()) {
  const [rewardPolicies, factionPolicies, candidates] = await Promise.all([
    database.rewardScoringPolicy.findMany({ include: { weights: { orderBy: { kind: "asc" } } }, orderBy: { version: "desc" } }),
    database.factionStandingScoringPolicy.findMany({ include: { weights: { orderBy: { kind: "asc" } } }, orderBy: { version: "desc" } }),
    database.rewardCandidate.findMany({ orderBy: [{ legendaryRewardId: "asc" }, { candidateKey: "asc" }] }),
  ]);
  return { rewardPolicies, factionPolicies, candidates };
}

export async function createRewardScoringPolicyVersion(input: {
  minimumScore: number;
  maximumScore: number;
  weights: Record<RewardEvidenceKind, number>;
}, database: PrismaClient = getDatabase()) {
  if (!Number.isFinite(input.minimumScore) || !Number.isFinite(input.maximumScore)
    || input.minimumScore > input.maximumScore) {
    throw new Error("Reward scoring policy requires finite ordered bounds.");
  }
  const kinds: RewardEvidenceKind[] = ["RUMOR", "EVIDENCE", "PROOF", "DOUBT", "CONTRADICTION", "REFUTATION"];
  for (const kind of kinds) {
    if (!Number.isFinite(input.weights[kind])) throw new Error(`Reward scoring policy requires a finite ${kind} weight.`);
  }
  return database.$transaction(async (transaction) => {
    const latest = await transaction.rewardScoringPolicy.findFirst({ orderBy: { version: "desc" } });
    const version = (latest?.version ?? 0) + 1;
    return transaction.rewardScoringPolicy.create({
      data: {
        rewardScoringPolicyId: `REWARD-POLICY-V${version}`,
        version,
        status: "DRAFT",
        minimumScore: input.minimumScore,
        maximumScore: input.maximumScore,
        weights: { create: kinds.map((kind) => ({ kind, weight: input.weights[kind] })) },
      },
      include: { weights: { orderBy: { kind: "asc" } } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function activateRewardScoringPolicyVersion(
  rewardScoringPolicyId: string,
  database: PrismaClient = getDatabase(),
) {
  return database.$transaction(async (transaction) => {
    const selected = await transaction.rewardScoringPolicy.findUniqueOrThrow({ where: { rewardScoringPolicyId } });
    if (selected.status !== "DRAFT") throw new Error("Only a draft reward scoring policy can be activated.");
    await transaction.rewardScoringPolicy.updateMany({ where: { status: "ACTIVE" }, data: { status: "RETIRED" } });
    return transaction.rewardScoringPolicy.update({ where: { rewardScoringPolicyId }, data: { status: "ACTIVE" } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function compareCapabilityProjection(database: PrismaClient = getDatabase()) {
  const [events, persistedStates] = await Promise.all([
    database.capabilityEvent.findMany({
      include: {
        capabilityAddress: true,
        capabilityDefinitionVersion: {
          include: {
            capabilityDefinition: true,
            parameters: { orderBy: { ordinal: "asc" } },
          },
        },
      },
      orderBy: { sequence: "asc" },
    }),
    database.capabilityState.findMany({ include: { capabilityAddress: true } }),
  ]);
  const definitions = new Map<string, CapabilityDefinitionVersionContract>();
  const ledger: CapabilityEventContract[] = events.map((persisted) => {
    const version = persisted.capabilityDefinitionVersion;
    const initialValue = initialValueFromRow(version);
    const contract: CapabilityDefinitionVersionContract = {
      capabilityDefinitionId: version.capabilityDefinitionId,
      capabilityDefinitionVersionId: version.capabilityDefinitionVersionId,
      code: version.capabilityDefinition.code,
      version: version.version,
      pathPattern: version.pathPattern,
      parameters: version.parameters,
      valueKind: version.valueKind,
      minValue: version.minValue,
      maxValue: version.maxValue,
      enumValues: version.enumValues,
      allowedReferenceEntityTypes: version.allowedReferenceEntityTypes,
      allowedOperations: version.allowedOperations,
      monotonicPolicy: version.monotonicPolicy,
      ...(initialValue === undefined ? {} : { initialValue }),
    };
    definitions.set(contract.capabilityDefinitionVersionId, contract);
    const bindings = persisted.capabilityAddress.bindings;
    if (typeof bindings !== "object" || bindings === null || Array.isArray(bindings)) {
      throw new Error(`CapabilityAddress ${persisted.capabilityAddressId} has invalid bindings.`);
    }
    const stringBindings = Object.fromEntries(Object.entries(bindings).map(([key, value]) => {
      if (typeof value !== "string") throw new Error(`CapabilityAddress ${persisted.capabilityAddressId} has a non-string binding.`);
      return [key, value];
    }));
    const address = resolveCapability(contract, stringBindings, () => true);
    const value = persistedEventValue(persisted);
    return {
      capabilityEventId: persisted.capabilityEventId,
      sequence: persisted.sequence,
      scope: { scopeType: persisted.scopeType, scopeId: persisted.scopeId },
      address,
      capabilityDefinitionVersionId: persisted.capabilityDefinitionVersionId,
      operation: persisted.operation,
      ...(value === undefined ? {} : { value }),
      ...(persisted.idempotencyKey ? { idempotencyKey: persisted.idempotencyKey } : {}),
      occurredAt: persisted.occurredAt,
      recordedAt: persisted.recordedAt,
    };
  });
  const rebuilt = projectCapabilityEvents([...definitions.values()], ledger, () => true);
  const mismatches: string[] = [];
  for (const persisted of persistedStates) {
    const bindings = persisted.capabilityAddress.bindings;
    const address = {
      capabilityDefinitionId: persisted.capabilityAddress.capabilityDefinitionId,
      bindings: typeof bindings === "object" && bindings !== null && !Array.isArray(bindings)
        ? Object.fromEntries(Object.entries(bindings).map(([key, value]) => [key, String(value)]))
        : {},
    };
    const key = capabilityStateKey({ scopeType: persisted.scopeType, scopeId: persisted.scopeId }, address);
    const expected = rebuilt.get(key);
    const actualValue = persistedEventValue(persisted);
    if (!expected || expected.isPresent !== persisted.isPresent || expected.lastSequence !== persisted.lastSequence
      || !valuesEqual(expected.value, actualValue)) {
      mismatches.push(key);
    }
  }
  for (const key of rebuilt.keys()) {
    if (!persistedStates.some((persisted) => capabilityStateKey(
      { scopeType: persisted.scopeType, scopeId: persisted.scopeId },
      {
        capabilityDefinitionId: persisted.capabilityAddress.capabilityDefinitionId,
        bindings: persisted.capabilityAddress.bindings as Record<string, string>,
      },
    ) === key)) mismatches.push(key);
  }
  return { eventCount: events.length, persistedStateCount: persistedStates.length, rebuiltStateCount: rebuilt.size, mismatches: [...new Set(mismatches)] };
}

export function capabilityReferenceValue(entityType: EntityType, entityId: string): CapabilityReferenceValue {
  return { entityType, entityId: nonempty(entityId, "Capability reference identity") };
}
