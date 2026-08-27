import { useState } from "react";

import { PlayerPuzzleSurface } from "../../components/puzzles/PlayerPuzzleSurface";
import { PublicShell } from "../../components/shells/Shells";
import type { PlayerPuzzle } from "../../server/puzzle-production-generators";
import type { ProductionPlayerSubmission, PublicRouteStage } from "../../server/puzzle-production-validation";

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(result.error ?? fallback);
  return result;
}

export function MemberPuzzlePage({ initialPuzzle }: { initialPuzzle: PlayerPuzzle }) {
  const [resetToken, setResetToken] = useState(0);
  const validate = async (submission: ProductionPlayerSubmission) => responseJson<{ correct: boolean }>(await fetch(`/api/member/puzzles/${initialPuzzle.publicSlug}`, {
    body: JSON.stringify({ operation: "validate", submission }),
    headers: { "content-type": "application/json" },
    method: "POST",
  }), "The archive could not check that answer.");
  const resolveRoute = async (threshold: number) => responseJson<PublicRouteStage>(await fetch(`/api/member/puzzles/${initialPuzzle.publicSlug}`, {
    body: JSON.stringify({ operation: "resolve-passage", threshold }),
    headers: { "content-type": "application/json" },
    method: "POST",
  }), "The passage did not open.");

  return <PublicShell><div className="member-puzzle-page stack"><nav aria-label="Puzzle collection"><a href="/puzzles">← Return to the collection</a></nav><PlayerPuzzleSurface onResolveRoute={initialPuzzle.publicSlug === "the-pall" ? resolveRoute : undefined} onValidate={validate} puzzle={initialPuzzle} resetToken={resetToken} /><div className="action-row action-row--between"><a className="button" href="/puzzles">All puzzles</a><button className="button" onClick={() => setResetToken((value) => value + 1)} type="button">Start this puzzle over</button></div></div></PublicShell>;
}
