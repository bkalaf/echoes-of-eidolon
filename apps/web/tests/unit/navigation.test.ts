import { describe, expect, it } from "vitest";

import { projectNavigation, type NavigationPrincipal } from "../../src/domain/navigation";
import { playerAccessResponse } from "../../src/server/access";

const principal = (
  role: NavigationPrincipal["role"],
  betaEligible: boolean,
  participationEligible = true,
  membershipEntitled = false,
): NavigationPrincipal => ({
  betaEligible,
  canPlay: betaEligible && participationEligible,
  membershipEntitled,
  participationEligible,
  role,
});

describe("authorized navigation projection", () => {
  it.each([
    ["guest", null, { account: false, administration: false, game: false, home: true, signOut: false }],
    ["user without beta", principal("user", false), { account: true, administration: false, game: false, home: true, signOut: true }],
    ["member without beta", principal("member", false), { account: true, administration: false, game: false, home: true, signOut: true }],
    ["admin without beta", principal("admin", false), { account: true, administration: true, game: false, home: true, signOut: true }],
    ["owner without beta", principal("owner", false), { account: true, administration: true, game: false, home: true, signOut: true }],
    ["user with beta", principal("user", true), { account: true, administration: false, game: true, home: true, signOut: true }],
    ["admin with beta", principal("admin", true), { account: true, administration: true, game: true, home: true, signOut: true }],
    ["owner with beta", principal("owner", true), { account: true, administration: true, game: true, home: true, signOut: true }],
  ] as const)("projects %s", (_label, access, expected) => {
    expect(projectNavigation(access)).toEqual(expected);
  });

  it("requires participation eligibility for game navigation", () => {
    expect(projectNavigation(principal("owner", true, false))).toMatchObject({ administration: true, game: false });
  });

  it("never substitutes membership for administration or player eligibility", () => {
    expect(projectNavigation(principal("member", false, true, true))).toMatchObject({ administration: false, game: false });
    expect(projectNavigation(principal("admin", false, true, true))).toMatchObject({ administration: true, game: false });
  });

  it.each([
    ["user", true, true],
    ["admin", true, false],
    ["owner", false, true],
  ] as const)("keeps the server canPlay projection aligned for %s", (role, betaEligible, participationEligible) => {
    const context = {
      betaEligible,
      email: `${role}@example.test`,
      membershipEntitled: true,
      participationEligible,
      role,
      sessionToken: "session-token",
      userId: `${role}-id`,
    };
    const response = playerAccessResponse(context);
    expect(response.canPlay).toBe(projectNavigation(response).game);
  });
});
