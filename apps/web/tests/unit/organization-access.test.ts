import { describe, expect, it } from "vitest";

import {
  organizationAdminRole,
  organizationMemberRole,
  organizationOwnerRole,
} from "../../src/domain/organization-access";

describe("Better Auth organization access control", () => {
  it("does not invent organization membership administration for any account role", () => {
    expect(organizationAdminRole.authorize({ member: ["update"] }).success).toBe(false);
    expect(organizationOwnerRole.authorize({ member: ["update"] }).success).toBe(false);
  });

  it("does not let baseline members administer organization records", () => {
    expect(organizationMemberRole.authorize({ member: ["create", "update", "delete"] }).success).toBe(false);
    expect(organizationMemberRole.authorize({ invitation: ["create", "cancel"] }).success).toBe(false);
  });

  it("keeps the installed organization pack inert until a workflow is supplied", () => {
    expect(organizationOwnerRole.authorize({ organization: ["update", "delete"] }).success).toBe(false);
    expect(organizationOwnerRole.authorize({ invitation: ["create", "cancel"] }).success).toBe(false);
    expect(organizationOwnerRole.authorize({ team: ["create", "update", "delete"] }).success).toBe(false);
    expect(organizationOwnerRole.authorize({ ac: ["create", "read", "update", "delete"] }).success).toBe(false);
  });
});
