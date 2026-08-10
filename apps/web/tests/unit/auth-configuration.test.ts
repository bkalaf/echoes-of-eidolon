import { describe, expect, it } from "vitest";

import { disabledDirectSessionRevocationPaths } from "../../src/server/auth";

describe("Better Auth session configuration", () => {
  it("disables generic endpoints that can revoke the current session by token", () => {
    expect(disabledDirectSessionRevocationPaths).toEqual([
      "/revoke-session",
      "/revoke-sessions",
    ]);
  });
});
