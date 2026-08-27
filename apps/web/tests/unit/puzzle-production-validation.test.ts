import { describe, expect, it } from "vitest";

import { getPuzzleGeneratorReadinessCatalog } from "../../src/server/puzzle-production-generators";
import type { CancellationPlayerArtifact, SetPlayerArtifact } from "../../src/server/puzzle-production-generators";
import {
  createProductionQaSandbox,
  resolveProductionPreviewRoute,
  revealProductionPreviewSolution,
  validateProductionPreviewSubmission,
  type ProductionPlayerSubmission,
} from "../../src/server/puzzle-production-validation";

const secret = "production-validation-test-secret-0000000000000000000000";
const ids = ["PZB-011", "PZB-012", "PZB-021", "PZB-037"] as const;

function correctSubmission(puzzleBlueprintId: (typeof ids)[number], solution: string, route?: Awaited<ReturnType<typeof resolveProductionPreviewRoute>>): ProductionPlayerSubmission {
  if (puzzleBlueprintId === "PZB-011") {
    const artifact = createProductionQaSandbox("PZB-011", 0, secret).playerPuzzle.artifact as CancellationPlayerArtifact;
    const markedCoordinates = artifact.matrixA.flatMap((row, rowIndex) => row.flatMap((value, columnIndex) => value + artifact.matrixB[rowIndex]![columnIndex]! === 0 ? [{ row: rowIndex + 1, column: columnIndex + 1 }] : []));
    return { kind: "bitmap-code", markedCoordinates, value: solution };
  }
  if (puzzleBlueprintId === "PZB-012") return { kind: "set", members: solution.split("-").map(Number) };
  if (puzzleBlueprintId === "PZB-037") return { kind: "hex", value: solution.toLocaleLowerCase("en-US") };
  return { kind: "ordered-symbols", symbols: [...route!.cards].sort((left, right) => left.notchCount - right.notchCount).map((card) => card.symbol), threshold: 128 };
}

function plausibleIncorrectSet(solution: string) {
  const artifact = createProductionQaSandbox("PZB-012", 0, secret).playerPuzzle.artifact as SetPlayerArtifact;
  const union = (left: number[], right: number[]) => [...new Set([...left, ...right])].sort((a, b) => a - b);
  const intersect = (left: number[], right: number[]) => left.filter((value) => right.includes(value)).sort((a, b) => a - b);
  const candidates = [
    intersect(union(artifact.sets.A, artifact.sets.B), artifact.sets.C),
    union(artifact.sets.A, intersect(artifact.sets.B, artifact.sets.C)),
    union(intersect(artifact.sets.A, artifact.sets.B), artifact.sets.C),
    intersect(artifact.sets.A, union(artifact.sets.B, artifact.sets.C)),
  ];
  return candidates.find((candidate) => candidate.join("-") !== solution)!;
}

describe("production puzzle validation and owner QA separation", () => {
  it("keeps the player payload answer-free and retrieves the solution only through the privileged path", async () => {
    for (const puzzleBlueprintId of ids) {
      const sandbox = createProductionQaSandbox(puzzleBlueprintId, 0, secret);
      const serialized = JSON.stringify(sandbox.playerPuzzle);
      expect(serialized).not.toMatch(/"(?:canonicalSolution|proofDigest|expectedSolution|encodedValue|decodeOffset|moduleMatrixTable)"\s*:/i);
      expect(sandbox.ownerQa.intendedSolvePath.length).toBeGreaterThan(1);
      expect(sandbox.ownerQa.hints).toHaveLength(2);
    }
  });

  it("accepts the real interaction state and rejects realistic near-solutions for all four", async () => {
    for (const puzzleBlueprintId of ids) {
      const reveal = revealProductionPreviewSolution(puzzleBlueprintId, 0, secret);
      const route = puzzleBlueprintId === "PZB-021" ? resolveProductionPreviewRoute(puzzleBlueprintId, 0, 128, secret) : undefined;
      const submission = correctSubmission(puzzleBlueprintId, reveal.expectedSolution, route);
      expect(validateProductionPreviewSubmission(puzzleBlueprintId, 0, submission, secret).correct).toBe(true);

      const near = puzzleBlueprintId === "PZB-011" ? { ...(submission as Extract<ProductionPlayerSubmission, { kind: "bitmap-code" }>), markedCoordinates: (submission as Extract<ProductionPlayerSubmission, { kind: "bitmap-code" }>).markedCoordinates.slice(1) }
        : puzzleBlueprintId === "PZB-012" ? { kind: "set", members: plausibleIncorrectSet(reveal.expectedSolution) } as const
          : puzzleBlueprintId === "PZB-037" ? { kind: "hex", value: `#${reveal.expectedSolution}` } as const
            : { ...(submission as Extract<ProductionPlayerSubmission, { kind: "ordered-symbols" }>), symbols: [...(submission as Extract<ProductionPlayerSubmission, { kind: "ordered-symbols" }>).symbols].reverse() };
      expect(validateProductionPreviewSubmission(puzzleBlueprintId, 0, near, secret).correct).toBe(false);
    }
  });

  it("rejects an unrecovered PZB-021 threshold and preserves the truthful 4/70 status", () => {
    expect(() => resolveProductionPreviewRoute("PZB-021", 0, 0, secret)).toThrow(/threshold/i);
    const readiness = getPuzzleGeneratorReadinessCatalog();
    expect(readiness.filter((entry) => entry.productionStatus === "PRODUCTION")).toHaveLength(4);
    expect(readiness.filter((entry) => entry.productionStatus === "PROTOTYPE_ONLY")).toHaveLength(66);
  });
});
