import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../server/access";
import { puzzlePreviewIdentitySchema, PuzzleAuthoringConflictError, validatePuzzlePreviewIdentity } from "../../../../server/puzzle-authoring";
import { getPuzzlePrototypeCatalog, puzzlePrototypeSubmissionSchema, validatePuzzlePrototype } from "../../../../server/puzzle-prototypes";

export const Route = createFileRoute("/api/admin/puzzles/preview")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        await requireAdministration(request);
        return Response.json(getPuzzlePrototypeCatalog());
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
        return Response.json(await validatePuzzlePreviewIdentity(puzzlePreviewIdentitySchema.parse(input)));
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Preview identity input is invalid." }, { status: 400 });
        if (error instanceof PuzzleAuthoringConflictError) return Response.json({ error: error.message }, { status: 409 });
        if (error instanceof Error && error.message.startsWith("Unknown Puzzle prototype:")) return Response.json({ error: error.message }, { status: 404 });
        return Response.json({ error: "Preview identity validation failed." }, { status: 500 });
      }
    },
  } },
});
