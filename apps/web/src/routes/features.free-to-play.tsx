import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "../components/shells/Shells";

export const Route = createFileRoute("/features/free-to-play")({
  head: () => ({
    meta: [
      { title: "Free to Play. Open to Everyone. | Echoes of Eidolon" },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: FreeToPlayPage,
});

function FreeToPlayPage() {
  return <PublicShell><main className="public-page"><a className="back-link" href="/features">← All Features</a><header className="page-head"><p className="eyebrow">Access</p><h1>Free to Play. Open to Everyone.</h1><p>Echoes of Eidolon is designed so access to the game is not conditioned on a paid subscription.</p></header><section className="card"><h2>A subscription will never be required.</h2><p>Membership benefits remain separate from authorization and beta/player eligibility.</p></section></main></PublicShell>;
}
