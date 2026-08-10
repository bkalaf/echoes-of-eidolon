import { describe, expect, it } from "vitest";

import {
  authorizationRoles,
  adminCapabilities,
  canAccessAdministration,
  canAccessGame,
  hasAdminCapability,
  hasMemberBenefits,
  resolveAuthorizationRole,
} from "../../src/domain/authorization";

describe("authorization roles", () => {
  it("defines only the owner-supplied role set", () => {
    expect(authorizationRoles).toEqual(["guest", "user", "member", "admin", "owner"]);
  });

  it.each([
    [false, null, "guest"],
    [true, null, null],
    [true, "member", "member"],
    [true, "admin", "admin"],
    [true, "owner", "owner"],
    [true, "member,admin", null],
    [true, "unknown", null],
  ] as const)("resolves authenticated=%s accountRole=%s to %s", (authenticated, accountRole, expected) => {
    expect(resolveAuthorizationRole(authenticated, accountRole)).toBe(expected);
  });

  it("allows only admin and owner into Administration", () => {
    expect(authorizationRoles.filter(canAccessAdministration)).toEqual(["admin", "owner"]);
  });

  it("gives admins the supplied capabilities except role changes", () => {
    expect(adminCapabilities.filter((capability) => hasAdminCapability("admin", capability))).toEqual([
      "reviewInvitations",
      "configurePerks",
      "operateBulkApi",
    ]);
    expect(adminCapabilities.filter((capability) => hasAdminCapability("owner", capability))).toEqual(adminCapabilities);
    expect(adminCapabilities.some((capability) => hasAdminCapability("member", capability))).toBe(false);
  });

  it.each([
    ["guest", false, false],
    ["guest", true, false],
    ["user", false, false],
    ["user", true, true],
    ["member", false, false],
    ["member", true, true],
    ["admin", false, false],
    ["admin", true, true],
    ["owner", false, true],
    ["owner", true, true],
  ] as const)("resolves game access for %s with betaEligible=%s", (role, betaEligible, expected) => {
    expect(canAccessGame(role, betaEligible)).toBe(expected);
  });

  it("keeps membership benefits separate from authorization and beta eligibility", () => {
    expect(hasMemberBenefits({ role: "member", membershipEntitled: true })).toBe(true);
    expect(hasMemberBenefits({ role: "admin", membershipEntitled: false })).toBe(false);
    expect(hasMemberBenefits({ role: "admin", membershipEntitled: true })).toBe(true);
    expect(hasMemberBenefits({ role: "owner", membershipEntitled: true })).toBe(false);
    expect(hasMemberBenefits({ role: "owner", membershipEntitled: false, ownerPolicyAllowsBenefits: true })).toBe(true);
  });
});
