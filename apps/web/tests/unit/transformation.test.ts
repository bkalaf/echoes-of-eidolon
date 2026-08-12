import { describe, expect, it } from "vitest";

import { awarenessAvailable, isFirstAssignedBookCompletion } from "../../src/domain/transformation";

describe("companion Transformation contract", () => {
  it("fires only at the end of the first assigned book without checking a particular companion key", () => {
    expect(isFirstAssignedBookCompletion([8, 3, 12], 3)).toBe(true);
    expect(isFirstAssignedBookCompletion([8, 3, 12], 8)).toBe(false);
    expect(isFirstAssignedBookCompletion([], 1)).toBe(false);
  });
  it("gates authored Awareness on the transformation fact", () => {
    expect(awarenessAvailable("EMPATHY", false)).toBe(false);
    expect(awarenessAvailable("EMPATHY", true)).toBe(true);
    expect(awarenessAvailable(null, true)).toBe(false);
  });
});
