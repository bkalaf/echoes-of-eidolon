import { describe, expect, it } from "vitest";

import {
  accountAdminRole,
  accountMemberRole,
  accountOwnerRole,
  accountUserRole,
} from "../../src/domain/authorization-access";
import { roleUpdateSchema } from "../../src/routes/api/admin/accounts/$userId/role";

describe("Better Auth account authorization", () => {
  it("allows only owners to change stored authorization roles", () => {
    expect(accountUserRole.authorize({ user: ["set-role"] }).success).toBe(false);
    expect(accountMemberRole.authorize({ user: ["set-role"] }).success).toBe(false);
    expect(accountAdminRole.authorize({ user: ["set-role"] }).success).toBe(false);
    expect(accountOwnerRole.authorize({ user: ["set-role"] }).success).toBe(true);
  });

  it("rejects fabricated fields in an authorization-role update", () => {
    expect(roleUpdateSchema.safeParse({ role: "member" }).success).toBe(true);
    expect(roleUpdateSchema.safeParse({ role: "member", username: "replacement" }).success).toBe(false);
  });

  it("allows admins and owners to administer users and sessions", () => {
    expect(accountAdminRole.authorize({ user: ["list", "get", "update"] }).success).toBe(true);
    expect(accountAdminRole.authorize({ session: ["list", "revoke", "delete"] }).success).toBe(true);
    expect(accountOwnerRole.authorize({ user: ["list", "get", "update"] }).success).toBe(true);
    expect(accountOwnerRole.authorize({ session: ["list", "revoke", "delete"] }).success).toBe(true);
  });

  it("does not allow an administrator to bypass email re-verification", () => {
    expect(accountAdminRole.authorize({ user: ["set-email"] }).success).toBe(false);
    expect(accountOwnerRole.authorize({ user: ["set-email"] }).success).toBe(false);
  });

  it("does not grant administration to users or members", () => {
    expect(accountUserRole.authorize({ user: ["list"] }).success).toBe(false);
    expect(accountMemberRole.authorize({ session: ["list"] }).success).toBe(false);
  });

  it("does not enable impersonation for any role", () => {
    expect(accountAdminRole.authorize({ user: ["impersonate"] }).success).toBe(false);
    expect(accountOwnerRole.authorize({ user: ["impersonate", "impersonate-admins"] }).success).toBe(false);
  });
});
