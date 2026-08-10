export const authorizationRoles = ["guest", "user", "member", "admin", "owner"] as const;
export const adminCapabilities = [
  "reviewInvitations",
  "configurePerks",
  "operateBulkApi",
  "changeAuthorizationRoles",
] as const;

export type AuthorizationRole = (typeof authorizationRoles)[number];
export type AdminCapability = (typeof adminCapabilities)[number];

export function resolveAuthorizationRole(
  authenticated: boolean,
  accountRole?: string | null,
): AuthorizationRole {
  if (!authenticated) return "guest";
  if (accountRole === "owner") return "owner";
  if (accountRole === "admin") return "admin";
  if (accountRole === "member") return "member";
  return "user";
}

export function canAccessAdministration(role: AuthorizationRole): boolean {
  return role === "admin" || role === "owner";
}

export function hasAdminCapability(
  role: AuthorizationRole,
  capability: AdminCapability,
): boolean {
  if (!canAccessAdministration(role)) return false;
  return capability !== "changeAuthorizationRoles" || role === "owner";
}

export function canAccessGame(
  role: AuthorizationRole,
  betaEligible: boolean,
): boolean {
  if (role === "guest") return false;
  return role === "owner" || betaEligible;
}

export function hasMemberBenefits(input: {
  membershipEntitled: boolean;
  ownerPolicyAllowsBenefits?: boolean;
  role: AuthorizationRole;
}): boolean {
  if (input.role === "guest") return false;
  if (input.role === "owner") return input.ownerPolicyAllowsBenefits === true;
  return input.membershipEntitled;
}
