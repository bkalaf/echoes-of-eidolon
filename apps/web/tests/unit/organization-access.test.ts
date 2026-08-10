import { describe, expect, it } from "vitest";

import {
  organizationAdminRole,
  organizationMemberRole,
  organizationOwnerRole,
} from "../../src/domain/organization-access";

describe("Better Auth organization access control", () => {
  it("prevents admins from changing organization authorization roles", () => {
    expect(organizationAdminRole.authorize({ member: ["update"] }).success).toBe(false);
    expect(organizationOwnerRole.authorize({ member: ["update"] }).success).toBe(true);
  });

  it("does not let baseline members administer organization records", () => {
    expect(organizationMemberRole.authorize({ member: ["create", "update", "delete"] }).success).toBe(false);
    expect(organizationMemberRole.authorize({ invitation: ["create", "cancel"] }).success).toBe(false);
  });
});
