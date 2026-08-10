import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

export const accountAuthorizationAccessControl = createAccessControl(defaultStatements);

const administeredUserActions = [
  "create",
  "list",
  "ban",
  "delete",
  "set-password",
  "set-email",
  "get",
  "update",
] as const;

const administeredSessionActions = ["list", "revoke", "delete"] as const;

export const accountUserRole = accountAuthorizationAccessControl.newRole({
  user: [],
  session: [],
});

export const accountMemberRole = accountAuthorizationAccessControl.newRole({
  user: [],
  session: [],
});

export const accountAdminRole = accountAuthorizationAccessControl.newRole({
  user: [...administeredUserActions],
  session: [...administeredSessionActions],
});

export const accountOwnerRole = accountAuthorizationAccessControl.newRole({
  user: [...administeredUserActions, "set-role"],
  session: [...administeredSessionActions],
});

export const accountAuthorizationRoles = {
  user: accountUserRole,
  member: accountMemberRole,
  admin: accountAdminRole,
  owner: accountOwnerRole,
};
