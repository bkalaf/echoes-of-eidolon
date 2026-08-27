import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUniqueOrThrow: vi.fn(), getSession: vi.fn() }));

vi.mock("../../src/server/auth", () => ({ getAuth: () => ({ api: { getSession: mocks.getSession } }) }));
vi.mock("../../src/server/database", () => ({ getDatabase: () => ({ user: { findUniqueOrThrow: mocks.findUniqueOrThrow } }) }));

import { requirePuzzleAccess } from "../../src/server/access";

const request = new Request("https://example.test/api/member/puzzles");

function user(role: "user" | "member" | "admin" | "owner", options: { active?: boolean; betaEligible?: boolean; expired?: boolean } = {}) {
  const now = Date.now();
  return {
    betaEligible: options.betaEligible ?? false,
    email: `${role}@example.test`,
    eligibilityStatus: "ADULT_18_PLUS",
    guardianConsents: [],
    membershipGrants: options.active || options.expired ? [{
      effectiveEndAt: new Date(now + (options.expired ? -86_400_000 : 86_400_000)),
      effectiveStartAt: new Date(now - 86_400_000),
      revocations: [],
    }] : [],
    role,
  };
}

describe("Member puzzle server authorization", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.findUniqueOrThrow.mockReset();
  });

  it("returns 401 for anonymous requests", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requirePuzzleAccess(request)).rejects.toMatchObject({ status: 401 });
  });

  it.each([
    ["ordinary non-member", user("user")],
    ["role-only member", user("member")],
    ["expired entitlement", user("member", { expired: true })],
    ["beta-only account", user("user", { betaEligible: true })],
  ])("returns 403 for %s", async (_label, account) => {
    mocks.getSession.mockResolvedValue({ session: { token: "token" }, user: { id: "user-id" } });
    mocks.findUniqueOrThrow.mockResolvedValue(account);
    await expect(requirePuzzleAccess(request)).rejects.toMatchObject({ status: 403 });
  });

  it.each([
    ["active Member", user("member", { active: true })],
    ["active entitled user", user("user", { active: true })],
    ["admin operational QA", user("admin")],
    ["owner operational QA", user("owner")],
  ])("allows %s", async (_label, account) => {
    mocks.getSession.mockResolvedValue({ session: { token: "token" }, user: { id: "user-id" } });
    mocks.findUniqueOrThrow.mockResolvedValue(account);
    await expect(requirePuzzleAccess(request)).resolves.toMatchObject({ userId: "user-id" });
  });
});
