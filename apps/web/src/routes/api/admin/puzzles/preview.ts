import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../server/access";
import { puzzlePreviewIdentitySchema, PuzzleAuthoringConflictError, validatePuzzlePreviewIdentity } from "../../../../server/puzzle-authoring";
import { getPuzzlePrototypeCatalog, puzzlePrototypeSubmissionSchema, validatePuzzlePrototype } from "../../../../server/puzzle-prototypes";
import { getAuthEnv } from "../../../../server/env";
import { validateProductionPreview } from "../../../../server/puzzle-production-generators";
import {
  createProductionQaSandbox,
  getProductionQaSandboxes,
  productionPuzzleBlueprintIds,
  resolveProductionPreviewRoute,
  validateProductionPreviewSubmission,
} from "../../../../server/puzzle-production-validation";
import { resolveTutorialProductionPreviewRoute, tutorialPuzzleBlueprintIds, validateTutorialProductionPreview } from "../../../../server/puzzle-tutorial-generators";

const productionSubmissionSchema = z.object({
  operation: z.literal("validate-production"),
  puzzleBlueprintId: z.string().regex(/^PZB-[0-9]{3}$/),
  answer: z.string().trim().min(1).max(2_000),
}).strict();

const tutorialSubmissionSchema = z.object({
  operation: z.literal("validate-tutorial"),
  puzzleBlueprintId: z.enum(tutorialPuzzleBlueprintIds),
  answer: z.string().trim().min(1).max(2_000),
}).strict();

const tutorialRouteSchema = z.object({
  operation: z.literal("resolve-tutorial-route"),
  puzzleBlueprintId: z.literal("PZB-021"),
  routeToken: z.string().min(1).max(200),
}).strict();

const productionPuzzleIdSchema = z.enum(productionPuzzleBlueprintIds);
const productionPlayerSubmissionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("coordinate"), row: z.number().int().min(1).max(100), column: z.number().int().min(1).max(100) }).strict(),
  z.object({ kind: z.literal("set"), members: z.array(z.number().int()).min(1).max(100) }).strict(),
  z.object({ kind: z.literal("hex"), value: z.string().min(1).max(32) }).strict(),
  z.object({ kind: z.literal("ordered-symbols"), symbols: z.array(z.string().min(1).max(1)).min(1).max(100), threshold: z.number().int().min(0).max(255) }).strict(),
]);
const productionPlayerValidationSchema = z.object({
  generation: z.number().int().min(0).max(10_000),
  operation: z.literal("validate-production-player"),
  puzzleBlueprintId: productionPuzzleIdSchema,
  submission: productionPlayerSubmissionSchema,
}).strict();
const regenerateProductionSchema = z.object({
  generation: z.number().int().min(0).max(10_000),
  operation: z.literal("regenerate-production"),
  puzzleBlueprintId: productionPuzzleIdSchema,
}).strict();
const productionRouteSchema = z.object({
  generation: z.number().int().min(0).max(10_000),
  operation: z.literal("resolve-production-route"),
  puzzleBlueprintId: z.literal("PZB-021"),
  threshold: z.number().int().min(0).max(255),
}).strict();

export const Route = createFileRoute("/api/admin/puzzles/preview")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        await requireAdministration(request);
        const catalog = getPuzzlePrototypeCatalog();
        const secret = getAuthEnv().BETTER_AUTH_SECRET;
        const productionIds = new Set<string>(productionPuzzleBlueprintIds);
        return Response.json({
          ...catalog,
          prototypes: catalog.prototypes.filter((prototype) => !productionIds.has(prototype.puzzleBlueprintId)),
          productionSandboxes: getProductionQaSandboxes(secret),
        }, { headers: { "cache-control": "no-store" } });
      } catch (error) {
        if (error instanceof Response) return error;
        return Response.json({ error: "Puzzle prototype catalog could not be loaded." }, { status: 500 });
      }
    },
    POST: async ({ request }) => {
      try {
        await requireAdministration(request);
        const input: unknown = await request.json();
        if (input && typeof input === "object" && "operation" in input && input.operation === "validate-prototype") {
          return Response.json(validatePuzzlePrototype(puzzlePrototypeSubmissionSchema.parse(input)));
        }
        if (input && typeof input === "object" && "operation" in input && input.operation === "validate-tutorial") {
          const parsed = tutorialSubmissionSchema.parse(input);
          return Response.json(validateTutorialProductionPreview(parsed.puzzleBlueprintId, parsed.answer, getAuthEnv().BETTER_AUTH_SECRET));
        }
        if (input && typeof input === "object" && "operation" in input && input.operation === "validate-production") {
          const parsed = productionSubmissionSchema.parse(input);
          return Response.json(validateProductionPreview(parsed.puzzleBlueprintId, parsed.answer, getAuthEnv().BETTER_AUTH_SECRET));
        }
        if (input && typeof input === "object" && "operation" in input && input.operation === "validate-production-player") {
          const parsed = productionPlayerValidationSchema.parse(input);
          return Response.json(validateProductionPreviewSubmission(parsed.puzzleBlueprintId, parsed.generation, parsed.submission, getAuthEnv().BETTER_AUTH_SECRET), { headers: { "cache-control": "no-store" } });
        }
        if (input && typeof input === "object" && "operation" in input && input.operation === "regenerate-production") {
          const parsed = regenerateProductionSchema.parse(input);
          return Response.json(createProductionQaSandbox(parsed.puzzleBlueprintId, parsed.generation, getAuthEnv().BETTER_AUTH_SECRET), { headers: { "cache-control": "no-store" } });
        }
        if (input && typeof input === "object" && "operation" in input && input.operation === "resolve-production-route") {
          const parsed = productionRouteSchema.parse(input);
          return Response.json(resolveProductionPreviewRoute(parsed.puzzleBlueprintId, parsed.generation, parsed.threshold, getAuthEnv().BETTER_AUTH_SECRET), { headers: { "cache-control": "no-store" } });
        }
        if (input && typeof input === "object" && "operation" in input && input.operation === "resolve-tutorial-route") {
          const parsed = tutorialRouteSchema.parse(input);
          return Response.json(resolveTutorialProductionPreviewRoute(parsed.puzzleBlueprintId, parsed.routeToken, getAuthEnv().BETTER_AUTH_SECRET));
        }
        return Response.json(await validatePuzzlePreviewIdentity(puzzlePreviewIdentitySchema.parse(input)));
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Preview identity input is invalid." }, { status: 400 });
        if (error instanceof PuzzleAuthoringConflictError) return Response.json({ error: error.message }, { status: 409 });
        if (error instanceof Error && (error.message.startsWith("Unknown Puzzle prototype:") || error.message.startsWith("Unknown production Puzzle Blueprint:"))) return Response.json({ error: error.message }, { status: 404 });
        if (error instanceof Error && error.message.startsWith("That threshold")) return Response.json({ error: error.message }, { status: 422, headers: { "cache-control": "no-store" } });
        return Response.json({ error: "Preview identity validation failed." }, { status: 500 });
      }
    },
  } },
});
