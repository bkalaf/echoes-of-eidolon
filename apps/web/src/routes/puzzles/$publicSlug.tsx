import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";

import { MemberPuzzlePage } from "../../screens/puzzles/MemberPuzzlePage";
import { requirePuzzleAccess } from "../../server/access";
import { getAuthEnv } from "../../server/env";
import { getMemberPuzzle, isProductionPuzzleSlug } from "../../server/member-puzzles";
import type { PlayerPuzzle } from "../../server/puzzle-production-generators";

const publicTitleBySlug: Readonly<Record<string, string>> = {
  "glass-vespers": "Glass Vespers",
  "quiet-accord": "The Quiet Accord",
  "the-pall": "The Pall",
  "third-reading": "The Third Reading",
};

const loadMemberPuzzle = createServerFn({ method: "GET" }).validator((value: string) => value).handler(async ({ data }) => {
  try {
    const access = await requirePuzzleAccess(getRequest());
    if (!isProductionPuzzleSlug(data)) return { access: "not-found" as const, puzzle: null };
    return { access: "ready" as const, puzzle: getMemberPuzzle(data, access.userId, getAuthEnv().BETTER_AUTH_SECRET) };
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
    if (status === 401) return { access: "anonymous" as const, puzzle: null };
    if (status === 403) { setResponseStatus(403); return { access: "forbidden" as const, puzzle: null }; }
    throw error;
  }
});

type PuzzleDetailLoaderData =
  | { access: "forbidden"; puzzle: null }
  | { access: "ready"; puzzle: PlayerPuzzle };

async function loadPuzzleDetail(publicSlug: string): Promise<PuzzleDetailLoaderData> {
  const result = await loadMemberPuzzle({ data: publicSlug });
  if (result.access === "anonymous") throw redirect({ href: `/auth/sign-in?returnTo=${encodeURIComponent(`/puzzles/${publicSlug}`)}` });
  if (result.access === "not-found") throw notFound();
  if (result.access === "forbidden") return { access: "forbidden", puzzle: null };
  return { access: "ready", puzzle: result.puzzle };
}

export const Route = createFileRoute("/puzzles/$publicSlug")({
  head: ({ params }) => ({ meta: [{ title: `${publicTitleBySlug[params.publicSlug] ?? "Witness Puzzle"} | Echoes of Eidolon` }, { name: "robots", content: "noindex,nofollow" }] }),
  headers: () => ({ "cache-control": "no-store, private" }),
  loader: ({ params }) => loadPuzzleDetail(params.publicSlug),
  component: PuzzleDetailRoute,
  notFoundComponent: () => <main className="not-found"><p className="kicker">404</p><h1>Puzzle not found</h1><a className="button" href="/puzzles">Return to the collection</a></main>,
  errorComponent: ({ error }) => <main className="not-found"><p className="kicker">Member Collection</p><h1>Access unavailable</h1><p>{error.message}</p><a className="button" href="/account/subscription">View membership</a></main>,
});

function PuzzleDetailRoute() {
  const result = Route.useLoaderData() as PuzzleDetailLoaderData;
  if (result.access === "forbidden") return <main className="not-found"><p className="kicker">Member Collection</p><h1>Access unavailable</h1><p>Current Member entitlement required.</p><a className="button" href="/account/subscription">View membership</a></main>;
  return <MemberPuzzlePage initialPuzzle={result.puzzle} />;
}
