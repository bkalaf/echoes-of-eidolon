import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

export const organizationAccessControl = createAccessControl(defaultStatements);

export const organizationMemberRole = organizationAccessControl.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
});

export const organizationAdminRole = organizationAccessControl.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
});

export const organizationOwnerRole = organizationAccessControl.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
});

export const organizationRoles = {
  admin: organizationAdminRole,
  member: organizationMemberRole,
  owner: organizationOwnerRole,
};
