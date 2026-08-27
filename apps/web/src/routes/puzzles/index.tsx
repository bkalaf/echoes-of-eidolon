import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";

import { MemberPuzzleHub } from "../../screens/puzzles/MemberPuzzleHub";
import { requirePuzzleAccess } from "../../server/access";
import { getMemberPuzzleCatalog } from "../../server/member-puzzles";

const loadMemberPuzzleCatalog = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await requirePuzzleAccess(getRequest());
    return { access: "ready" as const, puzzles: getMemberPuzzleCatalog() };
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
    if (status === 401) return { access: "anonymous" as const, puzzles: [] };
    if (status === 403) { setResponseStatus(403); return { access: "forbidden" as const, puzzles: [] }; }
    throw error;
  }
});

export const Route = createFileRoute("/puzzles/")({
  head: () => ({ meta: [{ title: "Witness Puzzles | Echoes of Eidolon" }, { name: "robots", content: "noindex,nofollow" }] }),
  headers: () => ({ "cache-control": "no-store, private" }),
  loader: async () => {
    const result = await loadMemberPuzzleCatalog();
    if (result.access === "anonymous") throw redirect({ href: "/auth/sign-in?returnTo=%2Fpuzzles" });
    return result;
  },
  component: PuzzleHubRoute,
  errorComponent: ({ error }) => <main className="not-found"><p className="kicker">Member Collection</p><h1>Access unavailable</h1><p>{error.message}</p><a className="button" href="/account/subscription">View membership</a></main>,
});

function PuzzleHubRoute() {
  const result = Route.useLoaderData();
  if (result.access === "forbidden") return <main className="not-found"><p className="kicker">Member Collection</p><h1>Access unavailable</h1><p>Current Member entitlement required.</p><a className="button" href="/account/subscription">View membership</a></main>;
  return <MemberPuzzleHub puzzles={result.puzzles} />;
}
