export const authorizationRoles = ["guest", "user", "member", "admin", "owner"] as const;

export type AuthorizationRole = (typeof authorizationRoles)[number];

export function resolveAuthorizationRole(
  authenticated: boolean,
  organizationRole?: string | null,
): AuthorizationRole {
  if (!authenticated) return "guest";
  const roles = new Set(
    (organizationRole ?? "")
      .split(",")
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean),
  );
  if (roles.has("owner")) return "owner";
  if (roles.has("admin")) return "admin";
  if (roles.has("member")) return "member";
  return "user";
}

export function canAccessAdministration(role: AuthorizationRole): boolean {
  return role === "admin" || role === "owner";
}

export function canAccessGame(role: AuthorizationRole): boolean {
  return role === "member" || role === "admin" || role === "owner";
}
