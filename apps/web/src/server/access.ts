import { canAccessAdministration, canAccessGame, hasAdminCapability, resolveAuthorizationRole, type AdminCapability, type AuthorizationRole } from "../domain/authorization";
import { projectMembershipEntitlement, voiceWindowSeconds } from "../domain/membership";
import { getAuth } from "./auth";
import { getDatabase } from "./database";

export interface ServerAccessContext {
  betaEligible: boolean;
  email: string;
  membershipEntitled: boolean;
  role: AuthorizationRole;
  sessionToken: string;
  userId: string;
}

export async function getServerAccessContext(request: Request): Promise<ServerAccessContext | null> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return null;

  const user = await getDatabase().user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      betaEligible: true,
      email: true,
      role: true,
      membershipGrants: {
        select: {
          effectiveEndAt: true,
          effectiveStartAt: true,
          revocations: { select: { effectiveEndAfter: true } },
        },
      },
    },
  });
  const membership = projectMembershipEntitlement(user.membershipGrants, new Date());

  return {
    betaEligible: user.betaEligible,
    email: user.email,
    membershipEntitled: membership.active,
    role: resolveAuthorizationRole(true, user.role),
    sessionToken: session.session.token,
    userId: session.user.id,
  };
}

export async function requireServerSession(request: Request): Promise<ServerAccessContext> {
  const access = await getServerAccessContext(request);
  if (!access) throw new Response("Authentication required.", { status: 401 });
  return access;
}

export async function requireAdminCapability(
  request: Request,
  capability: AdminCapability,
): Promise<ServerAccessContext> {
  const access = await requireServerSession(request);
  if (!hasAdminCapability(access.role, capability)) {
    throw new Response("Administrative capability required.", { status: 403 });
  }
  return access;
}

export async function requireAdministration(request: Request): Promise<ServerAccessContext> {
  const access = await requireServerSession(request);
  if (!canAccessAdministration(access.role)) {
    throw new Response("Administrative authorization required.", { status: 403 });
  }
  return access;
}

export async function requireAtlasAccess(request: Request): Promise<ServerAccessContext> {
  const access = await requireServerSession(request);
  if (!canAccessAdministration(access.role) && !canAccessGame(access.role, access.betaEligible)) {
    throw new Response("Atlas access requires administration or player eligibility.", { status: 403 });
  }
  return access;
}

export function playerAccessResponse(access: ServerAccessContext) {
  return {
    betaEligible: access.betaEligible,
    canPlay: canAccessGame(access.role, access.betaEligible),
    membershipEntitled: access.membershipEntitled,
    role: access.role,
    voiceWindowSeconds: voiceWindowSeconds(access.membershipEntitled),
  };
}
