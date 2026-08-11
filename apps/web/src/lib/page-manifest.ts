import amendments from "../data/page-manifest-v3-amendments.json";
import baseManifest from "../data/page-manifest.json";

export interface PageManifestEntry {
  page: number;
  screenId: string;
  title: string;
  path: string | null;
  source: string;
  originalPage: number;
  reviewOrder: number;
}

export type ShellKind =
  | "public"
  | "auth"
  | "account"
  | "store"
  | "admin"
  | "game"
  | "tools-review"
  | "state-only";

export const basePageManifest = Object.freeze(baseManifest as PageManifestEntry[]);
export const excludedV3ScreenIds = Object.freeze(amendments.excludedScreenIds as string[]);
export const v3PageManifestAdditions = Object.freeze(amendments.additions as PageManifestEntry[]);
const excluded = new Set(excludedV3ScreenIds);
export const pageManifest = Object.freeze([
  ...basePageManifest.filter((entry) => !excluded.has(entry.screenId)),
  ...v3PageManifestAdditions,
]);

export function shellFor(entry: PageManifestEntry): ShellKind {
  if (entry.path === null) return "state-only";
  const path = entry.path.replace(/^Modal in /, "");
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/account") || path.startsWith("/settings")) {
    return "account";
  }
  if (path.startsWith("/auth")) {
    return "auth";
  }
  if (path.startsWith("/store")) return "store";
  if (path.startsWith("/game")) {
    return "game";
  }
  if (path.startsWith("/tools") || path.startsWith("/review")) {
    return "tools-review";
  }
  return "public";
}

export function manifestByShell() {
  return pageManifest.reduce<Record<ShellKind, PageManifestEntry[]>>(
    (groups, entry) => {
      groups[shellFor(entry)].push(entry);
      return groups;
    },
    {
      public: [],
      auth: [],
      account: [],
      store: [],
      admin: [],
      game: [],
      "tools-review": [],
      "state-only": [],
    },
  );
}

function normalizedPattern(path: string) {
  return path.split("?")[0]?.replace(/^Modal in /, "") ?? path;
}

export function pathMatches(pattern: string, pathname: string) {
  const patternParts = normalizedPattern(pattern).split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
}

export function screensForPath(pathname: string) {
  return pageManifest.filter((entry) => entry.path !== null && pathMatches(entry.path, pathname));
}

export function screenForPath(pathname: string, requestedState?: string) {
  const matches = screensForPath(pathname);
  const requested = requestedState ? pageManifest.find((entry) => entry.screenId === requestedState) : undefined;
  const staticMatch = matches.find((entry) => !entry.path?.includes(":"));
  return matches.find((entry) => entry.screenId === requestedState) ?? (requested?.path === null ? requested : undefined) ?? staticMatch ?? matches[0];
}
