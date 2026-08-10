import { describe, expect, it } from "vitest";

import {
  authorizationRoles,
  canAccessAdministration,
  canAccessGame,
  resolveAuthorizationRole,
} from "../../src/domain/authorization";

describe("authorization roles", () => {
  it("defines only the owner-supplied role set", () => {
    expect(authorizationRoles).toEqual(["guest", "user", "member", "admin", "owner"]);
  });

  it.each([
    [false, null, "guest"],
    [true, null, "user"],
    [true, "member", "member"],
    [true, "admin", "admin"],
    [true, "owner", "owner"],
    [true, "member,admin", "admin"],
    [true, "unknown", "user"],
  ] as const)("resolves authenticated=%s organizationRole=%s to %s", (authenticated, organizationRole, expected) => {
    expect(resolveAuthorizationRole(authenticated, organizationRole)).toBe(expected);
  });

  it("allows only admin and owner into Administration", () => {
    expect(authorizationRoles.filter(canAccessAdministration)).toEqual(["admin", "owner"]);
  });

  it("allows member, admin and owner into the game", () => {
    expect(authorizationRoles.filter(canAccessGame)).toEqual(["member", "admin", "owner"]);
  });
});
