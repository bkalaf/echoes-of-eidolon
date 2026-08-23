import { describe, expect, it } from "vitest";

import { getPuzzleGeneratorReadinessCatalog } from "../../src/server/puzzle-production-generators";
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
    const [row, column] = solution.split(",").map(Number) as [number, number];
    return { kind: "coordinate", row, column };
  }
  if (puzzleBlueprintId === "PZB-012") return { kind: "set", members: solution.split("-").map(Number) };
  if (puzzleBlueprintId === "PZB-037") return { kind: "hex", value: solution.toLocaleLowerCase("en-US") };
  return { kind: "ordered-symbols", symbols: [...route!.cards].sort((left, right) => left.notchCount - right.notchCount).map((card) => card.symbol), threshold: 128 };
}

function plausibleIncorrectSet(solution: string) {
  const carrier = createProductionQaSandbox("PZB-012", 0, secret).playerPuzzle.carrier;
  if (carrier.kind !== "SET_AMBIGRAM") throw new Error("PZB-012 did not expose its authored set carrier.");
  const union = (left: number[], right: number[]) => [...new Set([...left, ...right])].sort((a, b) => a - b);
  const intersect = (left: number[], right: number[]) => left.filter((value) => right.includes(value)).sort((a, b) => a - b);
  const candidates = [
    intersect(union(carrier.sets.A, carrier.sets.B), carrier.sets.C),
    union(carrier.sets.A, intersect(carrier.sets.B, carrier.sets.C)),
    union(intersect(carrier.sets.A, carrier.sets.B), carrier.sets.C),
    intersect(carrier.sets.A, union(carrier.sets.B, carrier.sets.C)),
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

      const near = puzzleBlueprintId === "PZB-011" ? { kind: "coordinate", row: 1, column: 1 } as const
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
