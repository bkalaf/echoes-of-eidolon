import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  applyCapabilityDefinitionImport,
  parseCapabilityDefinitionImportRows,
} from "../../src/server/capability-definition-import";

const row = {
  capabilityDefinitionId: "CAP-LOCATION-DISCOVERED",
  code: "LOCATION_DISCOVERED",
  pathPattern: "location.{SITE}.discovered",
  valueKind: "BOOLEAN" as const,
  enumValues: [],
  allowedReferenceEntityTypes: [],
  allowedOperations: ["SET", "CLEAR"] as const,
  monotonicPolicy: "TRUE_ONLY" as const,
  initialValue: false,
  description: "Whether an authored site was discovered.",
  parameters: [{ name: "SITE", kind: "ENTITY" as const, entityType: "SITE" as const, allowedValues: [] }],
};

describe("typed CapabilityDefinition import", () => {
  it("accepts the versioned authoring contract and rejects ambiguous or invalid rows", () => {
    expect(parseCapabilityDefinitionImportRows([row])).toEqual([row]);
    expect(() => parseCapabilityDefinitionImportRows([{ ...row, extra: true }])).toThrow();
    expect(() => parseCapabilityDefinitionImportRows([{ ...row, pathPattern: "location.discovered" }])).toThrow(/path parameters/);
    expect(() => parseCapabilityDefinitionImportRows([row, row])).toThrow(/duplicates capabilityDefinitionId/);
  });

  it("creates one atomic draft version, treats its exact retry as unchanged, and rejects identity drift", async () => {
    const roots = new Map<string, { capabilityDefinitionId: string; code: string; versions: Array<Record<string, unknown>> }>();
    const transaction = {
      capabilityDefinition: {
        async findFirst({ where }: { where: { OR: Array<Record<string, string>> } }) {
          return [...roots.values()].find((root) => where.OR.some((clause) => Object.entries(clause).every(([key, value]) => root[key as "code"] === value))) ?? null;
        },
        async findUnique({ where }: { where: Record<string, string> }) {
          return [...roots.values()].find((root) => Object.entries(where).every(([key, value]) => root[key as "code"] === value)) ?? null;
        },
        async upsert({ where, create }: { where: { code: string }; create: { capabilityDefinitionId: string; code: string } }) {
          const existing = [...roots.values()].find((root) => root.code === where.code);
          if (existing) return { ...existing, versions: existing.versions.slice(0, 1).map((version) => ({ version: version.version })) };
          const created = { ...create, versions: [] };
          roots.set(create.capabilityDefinitionId, created);
          return created;
        },
      },
      capabilityDefinitionVersion: {
        async create({ data }: { data: Record<string, unknown> & { capabilityDefinitionId: string; parameters: { create: Array<Record<string, unknown>> } } }) {
          const root = roots.get(data.capabilityDefinitionId)!;
          root.versions.unshift({
            ...data,
            parameters: data.parameters.create.map((parameter) => ({
              name: parameter.name,
              kind: parameter.kind,
              entityType: parameter.entityType,
              allowedValues: parameter.allowedValues,
              ordinal: parameter.ordinal,
            })),
          });
          return root.versions[0];
        },
      },
    };
    const database = {
      $transaction: vi.fn(async (work: (client: typeof transaction) => Promise<unknown>) => work(transaction)),
    } as unknown as PrismaClient;

    await expect(applyCapabilityDefinitionImport([row], database)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyCapabilityDefinitionImport([row], database)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyCapabilityDefinitionImport([{ ...row, code: "OTHER_CODE" }], database))
      .rejects.toThrow(/stable identity conflict/);
    expect(database.$transaction).toHaveBeenCalledTimes(3);
  });
});
