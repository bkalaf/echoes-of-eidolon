import { describe, expect, it } from "vitest";

import { safeSignedInReturnPath } from "../../src/domain/auth-navigation";

describe("post-sign-in navigation", () => {
  const origin = "https://echoes.example";

  it("defaults to the account profile", () => {
    expect(safeSignedInReturnPath(null, origin)).toBe("/account/profile");
    expect(safeSignedInReturnPath("", origin)).toBe("/account/profile");
  });

  it("preserves a same-origin path, query and fragment", () => {
    expect(safeSignedInReturnPath("/game/maps?layer=known#present", origin)).toBe("/game/maps?layer=known#present");
  });

  it.each([
    "https://attacker.example/phish",
    "//attacker.example/phish",
    "not a valid URL%",
  ])("rejects unsafe return target %s", (candidate) => {
    expect(safeSignedInReturnPath(candidate, origin)).toBe("/account/profile");
  });
});
