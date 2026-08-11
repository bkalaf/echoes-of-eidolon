import { AdminShell } from "../../components/shells/Shells";
import { canAccessAdministration, resolveAuthorizationRole, type AuthorizationRole } from "../../domain/authorization";
import { authClient } from "../../lib/auth-client";
import type { PageManifestEntry } from "../../lib/page-manifest";
import { EntityImportPage } from "./EntityImportPage";
import { BetaInvitationAdminPage } from "./BetaInvitationAdminPage";
import { AccountAdminPage } from "./AccountAdminPage";
import { AtlasAdminPage } from "./AtlasAdminPage";
import { CampaignAdminPage } from "./CampaignAdminPage";
import { PuzzleAdminPage } from "./PuzzleAdminPage";
import { AssetPromptAdminPage } from "./AssetPromptAdminPage";
import { CommerceAdminPage } from "./CommerceAdminPage";
import { PerkAdminPage } from "./PerkAdminPage";
import { OperationsAdminPage } from "./OperationsAdminPage";
import { CapabilityAdminPage } from "./CapabilityAdminPage";
import { EntityDataAdminPage } from "./EntityDataAdminPage";
import { BulkOperationsAdminPage } from "./BulkOperationsAdminPage";
import { CityBuilderAdminPage } from "./CityBuilderAdminPage";
import { AdminDashboardPage } from "./AdminDashboardPage";

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

function DeniedAdminTask({ screen, role }: { screen: PageManifestEntry; role: AuthorizationRole | null }) {
  return <><AdminHead screen={screen} description="Administrative authorization is required for this reviewed task." /><section className="card"><h2>Administrative access denied</h2><p>Current authorization role: <strong>{role ?? "unrecognized"}</strong>.</p><p>{authorizationScope(screen)}</p><p className="notice notice--warn">Only the admin and owner roles may enter Administration. No record, count, provider state, or success result is exposed.</p></section></>;
}

function AuthorizedAdminTask({ pathname, screen, role }: { pathname: string; screen: PageManifestEntry; role: "admin" | "owner" }) {
  const isImport = screen.screenId.endsWith("_IMPORT");
  const isInvitationTask = ["ADM003", "ADM004", "ADM006"].includes(screen.screenId);
  const isAccountTask = ["ADM002", "ADM005"].includes(screen.screenId);
  const isAtlasTask = screen.path?.startsWith("/admin/atlas");
  const isCampaignTask = screen.path?.startsWith("/admin/campaign") || screen.screenId === "CAM006";
  const isPuzzleTask = screen.path?.startsWith("/admin/puzzles");
  const isAssetPromptTask = screen.path?.startsWith("/admin/assets") || screen.path?.startsWith("/admin/prompts");
  const isCommerceTask = screen.path?.startsWith("/admin/store") || screen.path?.startsWith("/admin/orders");
  const isPerkTask = screen.path?.startsWith("/admin/perks");
  const isOperationsTask = pathname === "/admin/server" || screen.path?.startsWith("/admin/operations");
  const isCapabilityTask = screen.screenId.startsWith("CAP") || screen.screenId === "DATA030";
  const isDataTask = screen.path?.startsWith("/admin/data");
  const isBulkTask = screen.path?.includes("bulk-operations");
  const isCityBuilderTask = screen.path?.startsWith("/admin/cities") || screen.screenId === "ADM037";
  const isDashboardTask = screen.screenId === "ADM001";
  return <><AdminHead screen={screen} description={`Administrative authorization verified for ${role}.`} />{isImport ? <EntityImportPage screen={screen} /> : isInvitationTask ? <BetaInvitationAdminPage role={role} screen={screen} /> : isOperationsTask ? <OperationsAdminPage screen={screen} /> : isAccountTask ? <AccountAdminPage pathname={pathname} role={role} /> : isCapabilityTask ? <CapabilityAdminPage pathname={pathname} screen={screen} /> : isAtlasTask ? <AtlasAdminPage screen={screen} /> : isCampaignTask ? <CampaignAdminPage screen={screen} /> : isPuzzleTask ? <PuzzleAdminPage pathname={pathname} screen={screen} /> : isAssetPromptTask ? <AssetPromptAdminPage screen={screen} /> : isCommerceTask ? <CommerceAdminPage screen={screen} /> : isPerkTask ? <PerkAdminPage pathname={pathname} /> : isBulkTask ? <BulkOperationsAdminPage screen={screen} /> : isDataTask ? <EntityDataAdminPage pathname={pathname} screen={screen} /> : isCityBuilderTask ? <CityBuilderAdminPage pathname={pathname} screen={screen} /> : isDashboardTask ? <AdminDashboardPage /> : <section className="card"><h2>{screen.title}</h2><p>Administrative authorization verified for {role}. This task has no writable adapter in the current repository authority.</p></section>}</>;
}

export function AdminPage({ pathname, screen }: { pathname?: string; screen: PageManifestEntry }) {
  const resolvedPathname = pathname ?? screen.path ?? "";
  const session = authClient.useSession();
  let page;
  if (session.isPending) {
    page = <><AdminHead screen={screen} description="Checking account session." /><p className="notice">Checking account session…</p></>;
  } else if (!session.data) {
    page = <><AdminHead screen={screen} description="An authenticated account and administrative authorization are required." /><section className="card"><h2>Sign in required</h2><p>No administrative data or actions are exposed without an authenticated session.</p><a className="button button--gold" href="/auth/sign-in">Sign In</a></section></>;
  } else {
    const role = resolveAuthorizationRole(true, session.data.user.role);
    page = canAccessAdministration(role)
      ? <AuthorizedAdminTask pathname={resolvedPathname} screen={screen} role={role as "admin" | "owner"} />
      : <DeniedAdminTask screen={screen} role={role} />;
  }
  return <AdminShell>{page}</AdminShell>;
}
