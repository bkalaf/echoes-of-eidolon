import { AdminShell } from "../../components/shells/Shells";
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

function DeferredAdminTask({ screen }: { screen: PageManifestEntry }) {
  return <><AdminHead screen={screen} description="Administrative authorization is required for this reviewed task." /><section className="card"><h2>Administrative authorization owner-deferred</h2><p>{authorizationScope(screen)}</p><p className="notice notice--warn">A valid account session alone does not grant administrative access. No role, record, count, provider state, or success result is fabricated.</p></section></>;
}

export function AdminPage({ screen }: { screen: PageManifestEntry }) {
  const session = authClient.useSession();
  let page;
  if (session.isPending) {
    page = <><AdminHead screen={screen} description="Checking account session." /><p className="notice">Checking account session…</p></>;
  } else if (!session.data) {
    page = <><AdminHead screen={screen} description="An authenticated account and administrative authorization are required." /><section className="card"><h2>Sign in required</h2><p>No administrative data or actions are exposed without an authenticated session.</p><a className="button button--gold" href="/auth/sign-in">Sign In</a></section></>;
  } else {
    page = <DeferredAdminTask screen={screen} />;
  }
  return <AdminShell>{page}</AdminShell>;
}
