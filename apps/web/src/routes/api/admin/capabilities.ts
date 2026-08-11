import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  CapabilityMonotonicPolicy,
  CapabilityOperation,
  CapabilityParameterKind,
  CapabilityValueKind,
  EntityType,
} from "../../../generated/prisma/enums";
import { requireAdministration } from "../../../server/access";
import {
  createCapabilityDefinitionVersion,
  listCapabilityDefinitions,
} from "../../../server/capability-ledger";

const definitionVersionSchema = z.object({
  capabilityDefinitionId: z.string().trim().min(1).optional(),
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_]*$/),
  pathPattern: z.string().trim().min(1),
  valueKind: z.enum(CapabilityValueKind),
  minValue: z.number().finite().nullable().optional(),
  maxValue: z.number().finite().nullable().optional(),
  enumValues: z.array(z.string().trim().min(1)).default([]),
  allowedReferenceEntityTypes: z.array(z.enum(EntityType)).default([]),
  allowedOperations: z.array(z.enum(CapabilityOperation)).min(1),
  monotonicPolicy: z.enum(CapabilityMonotonicPolicy),
  description: z.string().trim().min(1),
  parameters: z.array(z.object({
    name: z.string().trim().regex(/^[A-Z][A-Z0-9_]*$/),
    kind: z.enum(CapabilityParameterKind),
    entityType: z.enum(EntityType).nullable().optional(),
    allowedValues: z.array(z.string().trim().min(1)).default([]),
  })).default([]),
});

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) => typeof item === "bigint" ? item.toString() : item)) as unknown;
}

export const Route = createFileRoute("/api/admin/capabilities")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        await requireAdministration(request);
        return Response.json({ definitions: jsonSafe(await listCapabilityDefinitions()) });
      } catch (error) {
        if (error instanceof Response) return error;
        throw error;
      }
    },
    POST: async ({ request }) => {
      try {
        await requireAdministration(request);
        const version = await createCapabilityDefinitionVersion(definitionVersionSchema.parse(await request.json()));
        return Response.json({ version: jsonSafe(version) }, { status: 201 });
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof z.ZodError) return Response.json({ error: "Capability definition version input is invalid.", issues: error.issues }, { status: 400 });
        if (error instanceof Error) return Response.json({ error: error.message }, { status: 400 });
        throw error;
      }
    },
  } },
});
