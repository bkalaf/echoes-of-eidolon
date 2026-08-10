import manifest from "../data/page-manifest.json";

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

export const pageManifest = Object.freeze(manifest as PageManifestEntry[]);

export function shellFor(entry: PageManifestEntry): ShellKind {
  const path = entry.path;
  if (path === null) return "state-only";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/account") || path.startsWith("/settings")) {
    return "account";
  }
  if (path.startsWith("/auth") || path.startsWith("Modal in /auth")) {
    return "auth";
  }
  if (path.startsWith("/store")) return "store";
  if (path.startsWith("/game") || path.startsWith("Modal in /game")) {
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
