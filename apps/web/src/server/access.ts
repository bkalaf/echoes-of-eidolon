import { canAccessGame, hasAdminCapability, resolveAuthorizationRole, type AdminCapability, type AuthorizationRole } from "../domain/authorization";
import { getAuth } from "./auth";
import { getDatabase } from "./database";

export interface ServerAccessContext {
  betaEligible: boolean;
  email: string;
  role: AuthorizationRole;
  userId: string;
}

export async function getServerAccessContext(request: Request): Promise<ServerAccessContext | null> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return null;

  const organizationId = session.session.activeOrganizationId;
  const membership = organizationId
    ? await getDatabase().member.findUnique({
      where: { organizationId_userId: { organizationId, userId: session.user.id } },
      select: { role: true },
    })
    : null;
  const user = await getDatabase().user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { betaEligible: true, email: true },
  });

  return {
    betaEligible: user.betaEligible,
    email: user.email,
    role: resolveAuthorizationRole(true, membership?.role),
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

export function playerAccessResponse(access: ServerAccessContext) {
  return {
    betaEligible: access.betaEligible,
    canPlay: canAccessGame(access.role, access.betaEligible),
    role: access.role,
  };
}
