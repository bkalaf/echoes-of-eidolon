import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requirePuzzleAccess } from "../../../../server/access";
import { getAuthEnv } from "../../../../server/env";
import { getMemberPuzzle, isProductionPuzzleSlug, resolveMemberPuzzleRoute, validateMemberPuzzleSubmission } from "../../../../server/member-puzzles";

export const memberPuzzleSubmissionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bitmap-code"), markedCoordinates: z.array(z.object({ row: z.number().int().min(1).max(100), column: z.number().int().min(1).max(100) }).strict()).min(1).max(500), value: z.string().min(1).max(32) }).strict(),
  z.object({ kind: z.literal("set"), members: z.array(z.number().int()).min(1).max(100) }).strict(),
  z.object({ kind: z.literal("hex"), value: z.string().min(1).max(32) }).strict(),
  z.object({ kind: z.literal("ordered-symbols"), symbols: z.array(z.string().min(1).max(1)).min(1).max(100), threshold: z.number().int().min(0).max(255) }).strict(),
]);
const operationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("validate"), submission: memberPuzzleSubmissionSchema }).strict(),
  z.object({ operation: z.literal("resolve-passage"), threshold: z.number().int().min(0).max(255) }).strict(),
]);

function notFoundResponse() {
  return Response.json({ error: "Member puzzle not found." }, { status: 404, headers: { "cache-control": "no-store, private" } });
}

export const Route = createFileRoute("/api/member/puzzles/$publicSlug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const access = await requirePuzzleAccess(request);
          if (!isProductionPuzzleSlug(params.publicSlug)) return notFoundResponse();
          return Response.json(getMemberPuzzle(params.publicSlug, access.userId, getAuthEnv().BETTER_AUTH_SECRET), { headers: { "cache-control": "no-store, private" } });
        } catch (error) {
          if (error instanceof Response) return error;
          return Response.json({ error: "Member puzzle could not be loaded." }, { status: 500, headers: { "cache-control": "no-store, private" } });
        }
      },
      POST: async ({ params, request }) => {
        try {
          const access = await requirePuzzleAccess(request);
          if (!isProductionPuzzleSlug(params.publicSlug)) return notFoundResponse();
          const input = operationSchema.parse(await request.json());
          const secret = getAuthEnv().BETTER_AUTH_SECRET;
          const result = input.operation === "validate"
            ? validateMemberPuzzleSubmission(params.publicSlug, access.userId, input.submission, secret)
            : resolveMemberPuzzleRoute(params.publicSlug, access.userId, input.threshold, secret);
          return Response.json(result, { headers: { "cache-control": "no-store, private" } });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: "Puzzle interaction is invalid." }, { status: 400, headers: { "cache-control": "no-store, private" } });
          if (error instanceof Error && (/threshold/i.test(error.message) || /not available/i.test(error.message))) return Response.json({ error: error.message }, { status: 422, headers: { "cache-control": "no-store, private" } });
          return Response.json({ error: "Puzzle interaction could not be completed." }, { status: 500, headers: { "cache-control": "no-store, private" } });
        }
      },
    },
  },
});
