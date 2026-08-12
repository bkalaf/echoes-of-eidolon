import { z } from "zod";

export type ExternalBulkGatewayMode = "OFF" | "KEYED" | "KEYLESS";
export type BulkEnvelopeStatus = "RECEIVED" | "DRY_RUN_RUNNING" | "DRY_RUN_FAILED" | "PENDING_REVIEW" | "APPLYING" | "REVALIDATION_FAILED" | "APPLIED" | "DELETED";

const abilityTypeSchema = z.enum(["CHARISMA", "DEXTERITY", "INTELLIGENCE", "STAMINA", "STRENGTH", "WISDOM"]);
const affinitySchema = z.array(abilityTypeSchema).min(1).max(6).refine((values) => new Set(values).size === values.length, "Occupation affinity values must be unique.");
const occupationKeySchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/);
const envelopeBase = {
  version: z.literal("1"),
  entity: z.literal("occupation"),
  notes: z.string().trim().min(1).max(2_000),
};
const insertSchema = z.object({
  ...envelopeBase,
  records: z.array(z.object({
    key: occupationKeySchema,
    name: z.string().trim().min(1).max(200),
    attributeAffinity: affinitySchema,
  }).strict()).min(1).max(1_000),
}).strict();
const updateSchema = z.object({
  ...envelopeBase,
  records: z.array(z.object({
    match: z.object({ key: occupationKeySchema }).strict(),
    set: z.object({
      name: z.string().trim().min(1).max(200).optional(),
      attributeAffinity: affinitySchema.optional(),
      active: z.boolean().optional(),
    }).strict().refine((value) => Object.keys(value).length > 0, "At least one authored field is required."),
  }).strict()).min(1).max(1_000),
}).strict();
const deleteSchema = z.object({
  ...envelopeBase,
  records: z.array(z.object({ match: z.object({ key: occupationKeySchema }).strict() }).strict()).min(1).max(1_000),
}).strict();
const fetchSchema = z.object({
  ...envelopeBase,
  operation: z.literal("FETCH"),
  select: z.array(z.enum(["key", "name", "attributeAffinity", "active"])).min(1).max(4),
  where: z.object({
    all: z.array(z.object({
      field: z.literal("attributeAffinity"),
      operator: z.literal("CONTAINS"),
      value: abilityTypeSchema,
    }).strict()).max(6),
  }).strict().optional(),
  limit: z.number().int().min(1).max(500).default(100),
}).strict();

export type ParsedBulkRequest =
  | { operation: "INSERT"; payload: z.infer<typeof insertSchema> }
  | { operation: "UPDATE"; payload: z.infer<typeof updateSchema> }
  | { operation: "DELETE"; payload: z.infer<typeof deleteSchema> }
  | { operation: "FETCH"; payload: z.infer<typeof fetchSchema> };

export function parseBulkRequest(method: "DELETE" | "POST" | "PUT", value: unknown): ParsedBulkRequest {
  if (method === "POST" && typeof value === "object" && value !== null && "operation" in value) {
    return { operation: "FETCH", payload: fetchSchema.parse(value) };
  }
  if (method === "POST") return { operation: "INSERT", payload: insertSchema.parse(value) };
  if (method === "PUT") return { operation: "UPDATE", payload: updateSchema.parse(value) };
  return { operation: "DELETE", payload: deleteSchema.parse(value) };
}

export function effectiveBulkGatewayMode(
  session: { mode: ExternalBulkGatewayMode; lastActivityAt: Date } | null,
  now = new Date(),
): ExternalBulkGatewayMode {
  if (!session || session.mode === "OFF") return "OFF";
  return now.valueOf() - session.lastActivityAt.valueOf() >= 60 * 60 * 1_000 ? "OFF" : session.mode;
}

const terminalStatuses = new Set<BulkEnvelopeStatus>(["APPLIED", "DELETED"]);

export function isActionableEnvelope(
  sequence: bigint,
  queue: ReadonlyArray<{ sequence: bigint; status: BulkEnvelopeStatus }>,
): boolean {
  const head = queue.filter((entry) => !terminalStatuses.has(entry.status)).sort((left, right) => left.sequence < right.sequence ? -1 : left.sequence > right.sequence ? 1 : 0)[0];
  return head?.sequence === sequence;
}
