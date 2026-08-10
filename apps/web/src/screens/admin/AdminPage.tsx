import { useQuery } from "@tanstack/react-query";

import { AdminShell } from "../../components/shells/Shells";
import { canAccessAdministration, resolveAuthorizationRole, type AuthorizationRole } from "../../domain/authorization";
import { authClient } from "../../lib/auth-client";
import type { PageManifestEntry } from "../../lib/page-manifest";

function AdminHead({ screen, description }: { screen: PageManifestEntry; description: string }) {
  return <header className="workspace-page-head"><p className="kicker">ADMIN · {screen.screenId}</p><h1>{screen.title}</h1><p>{description}</p></header>;
}

function authorizationScope(screen: PageManifestEntry) {
  if (screen.screenId.endsWith("_IMPORT") || screen.path?.includes("bulk-operations")) {
    return "Import preview, validation reports, atomic apply, audit records, and external API status cannot be disclosed or invoked without administrative authorization.";
  }
  if (screen.path?.startsWith("/admin/data")) {
    return "Canonical record lists, editors, relationship lookups, create actions, and persistence cannot be disclosed or invoked without administrative authorization.";
  }
  if (screen.path?.startsWith("/admin/atlas") || screen.path?.startsWith("/admin/cities") || screen.path === "/admin/city-builder") {
    return "Atlas records, settlement operations, and city-authoring state cannot be disclosed or invoked without administrative authorization.";
  }
  if (screen.path?.startsWith("/admin/campaign") || screen.path?.startsWith("/admin/puzzles")) {
    return "Campaign assignments, puzzle records, validation runs, and authoring actions cannot be disclosed or invoked without administrative authorization.";
  }
  if (screen.path?.startsWith("/admin/store") || screen.path?.startsWith("/admin/orders")) {
    return "Catalog administration, payments, orders, and fulfillment state cannot be disclosed or invoked without administrative authorization.";
  }
  if (screen.path?.startsWith("/admin/access")) {
    return "Account records, roles, sessions, invitation requests, and invitation codes cannot be disclosed or changed without an administrative authorization owner.";
  }
  if (["OPS001", "OPS002"].includes(screen.screenId)) {
    return "Operational service detail, release state, restart controls, and deployment controls cannot be disclosed or invoked without administrative authorization and operations owners.";
  }
  return "This administrative task cannot disclose records, counts, status, or actions until an authoritative role field and server-side authorization owner are supplied.";
}

function DeniedAdminTask({ screen, role }: { screen: PageManifestEntry; role: AuthorizationRole }) {
  return <><AdminHead screen={screen} description="Administrative authorization is required for this reviewed task." /><section className="card"><h2>Administrative access denied</h2><p>Current authorization role: <strong>{role}</strong>.</p><p>{authorizationScope(screen)}</p><p className="notice notice--warn">Only the admin and owner roles may enter Administration. No record, count, provider state, or success result is exposed.</p></section></>;
}

function AuthorizedAdminTask({ screen, role }: { screen: PageManifestEntry; role: "admin" | "owner" }) {
  return <><AdminHead screen={screen} description="Organization authorization was verified for this reviewed task." /><section className="card"><h2>Administrative authorization verified</h2><p>Current authorization role: <strong>{role}</strong>.</p><p className="notice notice--warn">This task's records and actions remain unavailable until its server data adapter is connected. Authorization is no longer the blocker, and no sample data is substituted.</p></section></>;
}

export function AdminPage({ screen }: { screen: PageManifestEntry }) {
  const session = authClient.useSession();
  const organizationRole = useQuery({
    queryKey: ["authorization", "active-organization-role", session.data?.user.id],
    enabled: Boolean(session.data),
    queryFn: async () => {
      const result = await authClient.organization.getActiveMemberRole();
      if (result.error) throw new Error(result.error.message ?? "Organization authorization could not be verified.");
      return result.data?.role ?? null;
    },
    retry: false,
  });
  let page;
  if (session.isPending) {
    page = <><AdminHead screen={screen} description="Checking account session." /><p className="notice">Checking account session…</p></>;
  } else if (!session.data) {
    page = <><AdminHead screen={screen} description="An authenticated account and administrative authorization are required." /><section className="card"><h2>Sign in required</h2><p>No administrative data or actions are exposed without an authenticated session.</p><a className="button button--gold" href="/auth/sign-in">Sign In</a></section></>;
  } else if (organizationRole.isPending) {
    page = <><AdminHead screen={screen} description="Checking organization authorization." /><p className="notice">Checking organization authorization…</p></>;
  } else if (organizationRole.isError) {
    page = <><AdminHead screen={screen} description="Organization authorization could not be verified." /><section className="card"><h2>Administrative access unavailable</h2><p>{organizationRole.error.message}</p><p className="notice notice--warn">Access fails closed when the active organization role cannot be verified.</p></section></>;
  } else {
    const role = resolveAuthorizationRole(true, organizationRole.data);
    page = canAccessAdministration(role)
      ? <AuthorizedAdminTask screen={screen} role={role as "admin" | "owner"} />
      : <DeniedAdminTask screen={screen} role={role} />;
  }
  return <AdminShell>{page}</AdminShell>;
}
