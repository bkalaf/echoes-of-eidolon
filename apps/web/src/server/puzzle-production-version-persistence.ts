import { puzzleBlueprintDesignV2Schema, type PuzzleBlueprintDesignV1, type PuzzleBlueprintDesignV2 } from "../domain/puzzle-blueprint";
import { productionPresentationById } from "../domain/puzzle-production-version-catalog";

const playerRenderers = Object.freeze({
  "PZB-011": "apps/web/src/components/puzzles/OrdinalCancellationPuzzle.tsx",
  "PZB-012": "apps/web/src/components/puzzles/SetAmbigramPuzzle.tsx",
  "PZB-021": "apps/web/src/components/puzzles/TypographicQrPuzzle.tsx",
  "PZB-037": "apps/web/src/components/puzzles/MusicalHexPuzzle.tsx",
} as const);

const submissionKinds = Object.freeze({
  "PZB-011": "bitmap-code",
  "PZB-012": "set",
  "PZB-021": "ordered-symbols",
  "PZB-037": "hex",
} as const);

export function buildProductionPuzzleVersionAddition(puzzleBlueprintId: string, base: PuzzleBlueprintDesignV1) {
  const presentation = productionPresentationById(puzzleBlueprintId);
  if (!presentation) return null;
  const accessibilityModalities = [...presentation.accessibilityModes];
  const design: PuzzleBlueprintDesignV2 = {
    ...base,
    accessibilityModalities,
    answerFormat: presentation.answerFormat,
    concept: presentation.concept,
    schemaVersion: "puzzle-blueprint-design-v2",
    publicPresentation: {
      description: presentation.publicDescription,
      opening: presentation.opening,
      slug: presentation.publicSlug,
      title: presentation.publicTitle,
    },
    productionContract: {
      playerRenderer: playerRenderers[presentation.puzzleBlueprintId],
      status: "PRODUCTION",
      submissionKind: submissionKinds[presentation.puzzleBlueprintId],
    },
    serverValidationMethod: "SERVER_SIDE_STRUCTURED_EXACT_MATCH",
    uniquenessProofMethod: "DETERMINISTIC_GENERATOR_AND_SOLVER_EXACTLY_ONE",
  };
  return {
    design: puzzleBlueprintDesignV2Schema.parse(design),
    generatorVersion: presentation.generatorVersion,
    hints: presentation.hints.map((hint) => ({ kind: hint.kind, level: hint.level, template: hint.text })),
  };
}
