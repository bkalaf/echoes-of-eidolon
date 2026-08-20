import { describe, expect, it } from "vitest";

import {
  derivePuzzlePrototypeAnswer,
  getPuzzlePrototypeCatalog,
  validatePuzzlePrototype,
} from "../../src/server/puzzle-prototypes";

const testSecret = "test-only-puzzle-prototype-secret-000000000000000000000000";

describe("server-keyed Puzzle prototypes", () => {
  it("generates solvable carriers for all 70 entries without serializing answers", () => {
    const response = getPuzzlePrototypeCatalog(testSecret);
    expect(response.total).toBe(70);
    expect(response.timerStarted).toBe(false);
    expect(JSON.stringify(response)).not.toMatch(/sampleAnswer|answerHash|canonicalAnswer/i);
    for (const prototype of response.prototypes) {
      expect(prototype.challenge.clues.length).toBeGreaterThan(0);
      expect(prototype.challenge.instructions).toMatch(/subtract/i);
      const answer = derivePuzzlePrototypeAnswer(prototype, testSecret);
      expect(validatePuzzlePrototype({
        operation: "validate-prototype",
        puzzleBlueprintId: prototype.puzzleBlueprintId,
        answer,
      }, testSecret)).toEqual({
        correct: true,
        puzzleBlueprintId: prototype.puzzleBlueprintId,
        timerStarted: false,
      });
      for (const decoy of prototype.decoys) {
        expect(validatePuzzlePrototype({
          operation: "validate-prototype",
          puzzleBlueprintId: prototype.puzzleBlueprintId,
          answer: decoy,
        }, testSecret).correct).toBe(false);
      }
    }
  });

  it("changes answers when the server secret changes", () => {
    const prototype = getPuzzlePrototypeCatalog(testSecret).prototypes[0]!;
    expect(derivePuzzlePrototypeAnswer(prototype, testSecret)).not.toBe(
      derivePuzzlePrototypeAnswer(prototype, `${testSecret}-other`),
    );
  });
});
