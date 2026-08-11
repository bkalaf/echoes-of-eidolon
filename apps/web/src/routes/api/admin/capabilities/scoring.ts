import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RewardEvidenceKind } from "../../../../generated/prisma/enums";
import { requireAdministration } from "../../../../server/access";
import {
  createRewardScoringPolicyVersion,
  listCapabilityScoringPolicies,
} from "../../../../server/capability-ledger";

const kinds = Object.values(RewardEvidenceKind);
const inputSchema = z.object({
  minimumScore: z.number().finite(),
  maximumScore: z.number().finite(),
  weights: z.record(z.enum(RewardEvidenceKind), z.number().finite()),
}).superRefine((value, context) => {
  for (const kind of kinds) {
    if (!(kind in value.weights)) context.addIssue({ code: "custom", message: `Missing ${kind} weight.` });
  }
});

export const Route = createFileRoute("/api/admin/capabilities/scoring")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        await requireAdministration(request);
        return Response.json(await listCapabilityScoringPolicies());
      } catch (error) {
        if (error instanceof Response) return error;
        throw error;
      }
    },
    POST: async ({ request }) => {
      try {
        await requireAdministration(request);
        return Response.json({ policy: await createRewardScoringPolicyVersion(inputSchema.parse(await request.json())) }, { status: 201 });
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof z.ZodError) return Response.json({ error: "A complete finite reward scoring policy is required." }, { status: 400 });
        if (error instanceof Error) return Response.json({ error: error.message }, { status: 400 });
        throw error;
      }
    },
  } },
});
