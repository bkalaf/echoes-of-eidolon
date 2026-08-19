import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../server/access";
import { puzzlePreviewIdentitySchema, PuzzleAuthoringConflictError, validatePuzzlePreviewIdentity } from "../../../../server/puzzle-authoring";
import { getPuzzlePrototypeCatalog, puzzlePrototypeSubmissionSchema, validatePuzzlePrototype } from "../../../../server/puzzle-prototypes";
import { getAuthEnv } from "../../../../server/env";
import { getProductionPreviews, validateProductionPreview } from "../../../../server/puzzle-production-generators";
import { getTutorialProductionPreviews, resolveTutorialProductionPreviewRoute, tutorialPuzzleBlueprintIds, validateTutorialProductionPreview } from "../../../../server/puzzle-tutorial-generators";

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

export const Route = createFileRoute("/api/admin/puzzles/preview")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        await requireAdministration(request);
        const catalog = getPuzzlePrototypeCatalog();
        const secret = getAuthEnv().BETTER_AUTH_SECRET;
        return Response.json({ ...catalog, productionPuzzles: getProductionPreviews(secret), productionTutorials: getTutorialProductionPreviews(secret) });
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
        return Response.json({ error: "Preview identity validation failed." }, { status: 500 });
      }
    },
  } },
});
