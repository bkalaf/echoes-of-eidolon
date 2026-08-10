import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { AtlasGlobe } from "../../components/AtlasGlobe";
import { GameShell } from "../../components/shells/Shells";
import type { AuthorizationRole } from "../../domain/authorization";
import { calendarContract } from "../../domain/invariants";
import { authClient } from "../../lib/auth-client";
import type { PageManifestEntry } from "../../lib/page-manifest";

function GameHead({ title, description }: { title: string; description: string }) {
  return <header className="game-page-head"><p className="kicker">PLAYER VIEW</p><h1>{title}</h1><p>{description}</p></header>;
}

function DeferredRuntime({ children }: { children: ReactNode }) {
  return <section className="game-deferred"><h2>Player runtime owner-deferred</h2><p>{children}</p><p className="notice notice--warn">No player location, discovery, story, or challenge state is fabricated while the runtime contract is absent.</p></section>;
}

function RuntimeViewport({ screen }: { screen: PageManifestEntry }) {
  const nearby = screen.screenId === "GAME008";
  const exits = ["GAME009", "GAME010", "GAME_VIEW_SINGLE_EXIT"].includes(screen.screenId);
  return <><GameHead title={screen.title} description="The reviewed game viewport preserves freeform voice/text interaction and runtime-owned context." /><section className="game-viewport game-viewport--unavailable"><div className="game-runtime-empty"><DeferredRuntime>NPC identity and dialogue, BottomBar date/time/location, Witness state, and player-known surroundings require an authenticated player-runtime response.</DeferredRuntime><label>Speak or type freely<textarea placeholder="Player runtime unavailable" disabled /></label><button className="button button--gold" disabled>Send unavailable</button></div>{nearby && <aside className="exits"><h2>Nearby</h2><p>No player-known nearby records are available.</p></aside>}{exits && <aside className="exits"><h2>Exits</h2><p>No player-known exit records are available.</p></aside>}</section></>;
}

function Knowledge({ screen }: { screen: PageManifestEntry }) {
  const timeline = screen.screenId === "GAME016";
  const detail = screen.screenId === "GAME003";
  return <><GameHead title={screen.title} description={timeline ? "Discovered Knowledge items ordered against the player-visible timeline." : detail ? "Inspect one discovered Knowledge item without leaving its context." : "Browse discovered Knowledge and player-visible relationships."} /><div className={timeline ? "timeline-view" : "knowledge-graph knowledge-graph--empty"}><DeferredRuntime>Knowledge records, discovery state, visible links, content, and timeline placement require the player-runtime disclosure contract.</DeferredRuntime></div></>;
}

function Bookshelf({ screen }: { screen: PageManifestEntry }) {
  return <><GameHead title={screen.title} description="Read discovered Tomes with the reviewed bookshelf and paginated reader." /><div className="reader-actions"><button className="button" disabled>Previous</button><button className="button button--gold" disabled>Next</button></div><div className="reader"><aside className="books"><h2>Bookshelf</h2><p>No discovered Tome list is available.</p></aside><article className="page-paper page-paper--empty"><section className="tome-page tome-page--left"><h2>No Tome selected</h2><p>Tome identity, content, discovery state, and pagination require player-runtime source rows.</p><span aria-label="Left page number unavailable" className="tome-page-number tome-page-number--left">—</span></section><section className="tome-page tome-page--right"><p>No player-visible Tome content is available.</p><span aria-label="Right page number unavailable" className="tome-page-number tome-page-number--right">—</span></section></article></div></>;
}

function Maps({ screen }: { screen: PageManifestEntry }) {
  const globe = ["GAME005", "GAM005", "GAME_GLOBE_PRESENT", "GAME_GLOBE_TIMELINE", "GAME013"].includes(screen.screenId);
  const timeline = screen.screenId === "GAME_GLOBE_TIMELINE";
  return <><GameHead title={screen.title} description={timeline ? "Inspect the globe at a player-visible timeline position." : `Navigate the player-known ${globe ? "globe" : "map"}.`} /><div className="player-map player-map--empty">{globe && <AtlasGlobe onSelect={() => undefined} points={[]} unavailableMessage="Player-safe coordinate overlays are unavailable." />}<DeferredRuntime>Player-safe layers, discovered geography, current location, routes, and visible timeline data have no supplied disclosure contract.</DeferredRuntime><aside><h2>{timeline ? "Timeline" : "Map layers"}</h2><p>No player-known layer data is available.</p><button className="button" disabled>Player overlays unavailable</button></aside></div></>;
}

function WitnessTrial({ screen }: { screen: PageManifestEntry }) {
  return <><GameHead title={screen.title} description="Witness trial acceptance and challenge state." /><section className="trial-warning"><h2>Witness Trial</h2><p>Trial duration, hint sequence, retry rules, acceptance, timing, and persistence require the unresolved puzzle-runtime contract.</p><p className="notice notice--warn">No countdown starts and no challenge is accepted from this screen.</p><div className="action-row"><a className="button" href="/game">Return to game</a><button className="button button--gold" disabled>Accept unavailable</button></div></section></>;
}

function Companions({ screen }: { screen: PageManifestEntry }) {
  return <><GameHead title={screen.title} description="The Companion relationship joins three distinct world-matching Protagonists through one Soul and one Heirloom." /><div className="grid-3">{["Concord Protagonist", "Ruin Protagonist", "Schism Protagonist"].map((world) => <article className="card" key={world}><h2>{world}</h2><p>No player-visible linked identity is available.</p></article>)}</div><section className="card companion-link"><span>Soul</span><span>Heirloom</span></section><p className="notice notice--warn">Companion records, player disclosure, and the exact Heirloom controlled values are owner-deferred.</p></>;
}

function Calendar({ screen }: { screen: PageManifestEntry }) {
  const countedWeekdays = Array.from({ length: calendarContract.countedWeekdays }, (_, index) => `Counted weekday ${index + 1}`);
  const monthDays = Array.from({ length: calendarContract.daysPerMonth }, (_, index) => index + 1);
  const preYearDays = [25, 26, 27] as const;
  return <><GameHead title={screen.title} description="Authoritative calendar structure without invented ordinal names, dates, or events." /><section className="calendar"><header><button className="button" disabled>Previous</button><div><h2>Month unavailable</h2><p>{calendarContract.monthsPerYear} months per year · {calendarContract.daysPerMonth} days per month</p></div><button className="button" disabled>Next</button></header><div className="pre-year-days" aria-label="Pre-year story days"><h3>Pre-year story days</h3>{preYearDays.map((day) => <span key={day}>Yearsend {day}</span>)}</div><div className="calendar-grid" role="grid" aria-label="Calendar month">{countedWeekdays.map((day) => <strong key={day}>{day}</strong>)}{monthDays.map((day) => <span className="calendar-day" key={day}>{day}</span>)}</div><p className="notice notice--warn">{calendarContract.excludedWeekday} is hidden and excluded from the counted week. Exact weekday and month names, current date, and visible event rows require the authoritative ordinal/runtime source rows.</p></section></>;
}

function SettingsOverlay({ screen }: { screen: PageManifestEntry }) {
  return <><RuntimeViewport screen={screen} /><div className="modal-backdrop game-modal"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="game-settings-title"><p className="kicker">SHARED SETTINGS</p><h2 id="game-settings-title">Game Settings</h2><p>The reviewed settings controls have no supplied persistence owner or stored-value contract.</p><p className="notice notice--warn">Settings remain unavailable instead of being stored in an invented browser or database schema.</p><a className="button" href="/game">Close</a></section></div></>;
}

function SignedInGamePage({ screen }: { screen: PageManifestEntry }) {
  if (["GAME001", "GAME008", "GAME009", "GAME010", "GAM001", "GAME_VIEW_FULL", "GAME_VIEW_NO_COUNTDOWN", "GAME_VIEW_SINGLE_EXIT"].includes(screen.screenId)) return <RuntimeViewport screen={screen} />;
  if (["GAME002", "GAME003", "GAME016", "GAM002"].includes(screen.screenId)) return <Knowledge screen={screen} />;
  if (["GAME004", "GAM003"].includes(screen.screenId)) return <Bookshelf screen={screen} />;
  if (["GAME005", "GAME006", "GAME007", "GAME013", "GAM004", "GAM005", "GAME_GLOBE_PRESENT", "GAME_GLOBE_TIMELINE"].includes(screen.screenId)) return <Maps screen={screen} />;
  if (screen.screenId === "GAME011") return <WitnessTrial screen={screen} />;
  if (screen.screenId === "GAME012") return <Companions screen={screen} />;
  if (screen.screenId === "GAME014") return <Calendar screen={screen} />;
  return <SettingsOverlay screen={screen} />;
}

export function GamePage({ screen }: { screen: PageManifestEntry }) {
  const session = authClient.useSession();
  const playerAccess = useQuery({
    queryKey: ["authorization", "player-access", session.data?.user.id],
    enabled: Boolean(session.data),
    queryFn: async () => {
      const response = await fetch("/api/player/access");
      if (!response.ok) throw new Error("Player access could not be verified.");
      return response.json() as Promise<{ betaEligible: boolean; canPlay: boolean; role: AuthorizationRole }>;
    },
    retry: false,
  });
  let page: ReactNode;
  if (session.isPending) {
    page = <><GameHead title={screen.title} description="Checking player session." /><p className="notice">Checking player session…</p></>;
  } else if (!session.data) {
    page = <><GameHead title={screen.title} description="An authenticated player session is required." /><section className="game-deferred"><h2>Sign in required</h2><p>No player, story, location, discovery, or challenge state is shown without an authenticated session.</p><a className="button button--gold" href="/auth/sign-in">Sign In</a></section></>;
  } else if (playerAccess.isPending) {
    page = <><GameHead title={screen.title} description="Checking player eligibility." /><p className="notice">Checking player eligibility…</p></>;
  } else if (playerAccess.isError) {
    page = <><GameHead title={screen.title} description="Player access could not be verified." /><section className="game-deferred"><h2>Game access unavailable</h2><p>Access fails closed when beta/player eligibility cannot be verified.</p></section></>;
  } else if (!playerAccess.data.canPlay) {
    page = <><GameHead title={screen.title} description="Verified player eligibility is required." /><section className="game-deferred"><h2>Player eligibility required</h2><p>Authorization role and membership entitlement do not grant game access. A verified beta/player-eligibility decision is required.</p></section></>;
  } else {
    page = <SignedInGamePage screen={screen} />;
  }
  return <GameShell><main className="game-page">{page}</main></GameShell>;
}
