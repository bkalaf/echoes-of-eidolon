import { shellFor, type PageManifestEntry, type ShellKind } from "../lib/page-manifest";

export const navigationAuditStatuses = [
  "REACHABLE",
  "ROLE_GATED_REACHABLE",
  "STATE_TRIGGERED",
  "ORPHANED",
  "DEAD_END",
  "BROKEN_LINK",
] as const;

export type NavigationAuditStatus = (typeof navigationAuditStatuses)[number];
export type NavigationAuthorization = "public" | "authenticated" | "administration" | "game";

export interface NavigationDeclaration {
  authorization: NavigationAuthorization;
  entryPoint: string;
  parentAction: string;
  exitDestination: string | null;
  automatedCoverage: string[];
}

export interface NavigationAuditEntry extends NavigationDeclaration {
  reviewOrder: number;
  screenId: string;
  title: string;
  routeOrState: string;
  kind: "route" | "state" | "modal";
  shell: ShellKind;
  routeRegistered: boolean;
  status: NavigationAuditStatus;
}

function screenKind(entry: PageManifestEntry): NavigationAuditEntry["kind"] {
  if (entry.path === null) return "state";
  return entry.path.startsWith("Modal in ") ? "modal" : "route";
}

export function projectNavigationAuditEntry(
  entry: PageManifestEntry,
  declaration: NavigationDeclaration | undefined,
  routeRegistered: boolean,
): NavigationAuditEntry {
  const kind = screenKind(entry);
  const completeEntry = Boolean(declaration?.entryPoint && declaration.parentAction && declaration.automatedCoverage.length);
  let status: NavigationAuditStatus;
  if (!routeRegistered) status = "BROKEN_LINK";
  else if (!completeEntry) status = "ORPHANED";
  else if (!declaration?.exitDestination) status = "DEAD_END";
  else if (kind !== "route") status = "STATE_TRIGGERED";
  else if (declaration.authorization === "public") status = "REACHABLE";
  else status = "ROLE_GATED_REACHABLE";

  return {
    reviewOrder: entry.reviewOrder,
    screenId: entry.screenId,
    title: entry.title,
    routeOrState: entry.path ?? "state-only",
    kind,
    shell: shellFor(entry),
    authorization: declaration?.authorization ?? "public",
    entryPoint: declaration?.entryPoint ?? "",
    parentAction: declaration?.parentAction ?? "",
    exitDestination: declaration?.exitDestination ?? null,
    automatedCoverage: declaration?.automatedCoverage ?? [],
    routeRegistered,
    status,
  };
}
