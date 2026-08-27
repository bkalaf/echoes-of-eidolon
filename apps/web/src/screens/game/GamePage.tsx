import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { AtlasGlobe } from "../../components/AtlasGlobe";
import { SettingsPanel } from "../../components/SettingsPanel";
import { GameShell } from "../../components/shells/Shells";
import { managedAssetUrl } from "../../content/managed-assets";
import type { AuthorizationRole } from "../../domain/authorization";
import { calendarContract } from "../../domain/invariants";
import { authClient } from "../../lib/auth-client";
import type { PageManifestEntry } from "../../lib/page-manifest";
import type { AtlasCatalogProjection } from "../../server/atlas";
import { GameplayOverlayForScreen } from "./GameplayOverlays";

interface PlayerPuzzle {
  acceptance: null | { acceptedAt: string; endsAt: string; puzzleChallengeAcceptedId: string; remainingSeconds: number };
  difficultyTier: string;
  family: string;
  generatorVersion: string;
  hints: Array<{ kind: string; level: number; template: string }>;
  name: string;
  puzzleBlueprintId: string;
}

function GameHead({ title, description }: { title: string; description: string }) {
  return <header className="game-page-head"><p className="kicker">PLAYER VIEW</p><h1>{title}</h1><p>{description}</p></header>;
}

function DeferredRuntime({ children }: { children: ReactNode }) {
  return <section className="game-deferred"><h2>Player runtime owner-deferred</h2><p>{children}</p><p className="notice notice--warn">No player location, discovery, story, or challenge state is fabricated while the runtime contract is absent.</p></section>;
}

function RuntimeViewport({ screen }: { screen: PageManifestEntry }) {
  const nearby = screen.screenId === "GAME008";
  const exits = ["GAME009", "GAME010", "GAME_VIEW_SINGLE_EXIT"].includes(screen.screenId);
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const runtime = useQuery({
    queryKey: ["player-runtime"],
    queryFn: async () => {
      const response = await fetch("/api/player/runtime");
      if (!response.ok) throw new Error("Player-safe runtime context could not be loaded.");
      return response.json() as Promise<{ location: null | { classification: string; latitude: number; longitude: number; name: string | null; regionId: string; siteId: string; worldKey: string }; nearby: []; exits: []; turns: Array<{ gameTurnId: string; inputText: string; responseText: string | null; status: string }> }>;
    },
  });
  return <><GameHead title={screen.title} description="Authenticated player-safe context with freeform text at the bounded NPC runtime port." /><section className="game-viewport"><div className="game-runtime-empty">{runtime.isPending && <p className="notice">Loading player context…</p>}{runtime.isError && <p className="notice notice--bad">{runtime.error.message}</p>}{runtime.data?.location && <section className="card"><p className="kicker">CURRENT LOCATION · {runtime.data.location.worldKey}</p><h2>{runtime.data.location.name ?? runtime.data.location.siteId}</h2><p>{runtime.data.location.classification} · {runtime.data.location.regionId}</p><p className="muted">{runtime.data.location.latitude}, {runtime.data.location.longitude}</p></section>}{runtime.data?.turns.map((turn) => <article className="card" key={turn.gameTurnId}><p><strong>You</strong> {turn.inputText}</p>{turn.responseText ? <p><strong>Response</strong> {turn.responseText}</p> : <small>{turn.status === "FAILED" ? "The external NPC runtime provider is not configured; the turn was recorded." : turn.status}</small>}</article>)}<form onSubmit={async (event) => { event.preventDefault(); if (!inputText.trim()) return; setSubmitting(true); setMessage(""); const response = await fetch("/api/player/runtime", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inputText }) }); setInputText(""); setSubmitting(false); setMessage(response.status === 503 ? "Turn recorded. The external NPC runtime provider is not configured." : response.ok ? "Response received." : "The turn could not be recorded."); await runtime.refetch(); }}><label>Speak or type freely<textarea maxLength={4000} onChange={(event) => setInputText(event.target.value)} placeholder="What do you say or do?" value={inputText} /></label><button className="button button--gold" disabled={submitting || inputText.trim().length === 0}>{submitting ? "Sending…" : "Send"}</button>{message && <p className="notice" role="status">{message}</p>}</form></div>{nearby && <aside className="exits"><h2>Nearby</h2><p>{runtime.data?.nearby.length === 0 ? "No player-known nearby records." : "Loading…"}</p></aside>}{exits && <aside className="exits"><h2>Exits</h2><p>{runtime.data?.exits.length === 0 ? "No player-known exits." : "Loading…"}</p></aside>}</section></>;
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
  const regional = screen.screenId === "GAME006";
  const city = screen.screenId === "GAME007";
  const sky = screen.screenId === "GAME013";
  const [selectedId, setSelectedId] = useState<string>();
  const atlas = useQuery({
    queryKey: ["player", "atlas-catalog"],
    enabled: !city && !sky,
    queryFn: async () => {
      const response = await fetch("/api/atlas/catalog");
      if (!response.ok) throw new Error("The verified player Atlas catalog could not be loaded.");
      return response.json() as Promise<AtlasCatalogProjection>;
    },
    retry: false,
  });
  const selected = atlas.data?.pointsOfInterest.find((point) => point.poiId === selectedId);
  const globeLocations = useMemo(() => (atlas.data?.pointsOfInterest ?? []).map((point) => ({ id: point.poiId, label: point.displayName ?? point.workingLabel, latticeId: point.latticeId, latitude: point.latitude, longitude: point.longitude, regionId: point.regionId })), [atlas.data?.pointsOfInterest]);
  if (city || sky) return <><GameHead title={screen.title} description={city ? "Street-level city map for the current player location." : "Player-visible constellation and sky view."} /><div className="player-map player-map--empty"><DeferredRuntime>{city ? "The current City street, parcel, landmark, and player-discovery projection is not owned by the player runtime." : "Constellation visibility and the player sky timeline have no supplied disclosure contract."}</DeferredRuntime></div></>;
  return <><GameHead title={screen.title} description={timeline ? "Inspect the verified globe while temporal disclosure remains fail-closed." : `Navigate the verified player-accessible Atlas ${globe ? "globe" : regional ? "region view" : "map"}.`} /><div className="player-map"><section>{atlas.isPending && <p className="notice">Loading verified Atlas catalog…</p>}{atlas.isError && <p className="notice notice--bad" role="alert">{atlas.error.message}</p>}{atlas.data && (globe
      ? <AtlasGlobe locations={globeLocations} onSelect={setSelectedId} selectedId={selectedId} />
      : <div className="map player-atlas-map"><img alt="Eidolon world map" src={managedAssetUrl("atlas.official-world-founding-cities")} />{atlas.data.pointsOfInterest.map((point) => <button aria-label={`Select ${point.displayName ?? point.workingLabel}`} className={`map-data-pin ${point.poiId === selectedId ? "selected" : ""}`} key={point.poiId} onClick={() => setSelectedId(point.poiId)} style={{ left: `${((point.longitude + 180) / 360) * 100}%`, top: `${((90 - point.latitude) / 180) * 100}%` }} />)}</div>)}</section><aside><h2>{timeline ? "Timeline" : regional ? "Region view" : "Atlas locations"}</h2>{atlas.data && <><p>{atlas.data.pointsOfInterest.length} canonical Points of Interest · {atlas.data.coordinateReferenceSystem}</p>{selected ? <dl className="detail-list"><dt>Name</dt><dd>{selected.displayName ?? selected.workingLabel}</dd><dt>Region</dt><dd>{selected.regionId}</dd><dt>Category</dt><dd>{selected.category}</dd><dt>Coordinates</dt><dd>{selected.latitude}, {selected.longitude}</dd></dl> : <p>Select a catalog marker for its physical Atlas record.</p>}</>}{timeline && <p className="notice notice--warn">No player-visible historical-year projection is persisted, so the present catalog is not relabeled as historical.</p>}<p className="muted">Atlas access is authoritative. Discovery status, routes, politics, and historical visibility are not inferred from physical catalog membership.</p><button className="button" disabled>Discovery overlays unavailable</button></aside></div></>;
}

function WitnessTrial({ screen }: { screen: PageManifestEntry }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const challenges = useQuery({ queryKey: ["player", "puzzles"], queryFn: async () => { const response = await fetch("/api/player/puzzles"); const result = await response.json() as { error?: string; puzzles?: PlayerPuzzle[] }; if (!response.ok || !result.puzzles) throw new Error(result.error ?? "Assigned challenges could not be loaded."); return result.puzzles; }, retry: false });
  const puzzle = challenges.data?.[0];
  useEffect(() => {
    if (!puzzle?.acceptance) return;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [puzzle?.acceptance]);
  const remainingSeconds = puzzle?.acceptance ? Math.max(0, Math.ceil((new Date(puzzle.acceptance.endsAt).getTime() - clock) / 1000)) : null;
  return <><GameHead title={screen.title} description="Explicit Witness Trial acceptance, immutable challenge timing, and ordered hints." /><section className="trial-warning"><h2>Witness Trial</h2>{challenges.isPending ? <p className="notice">Loading assigned challenge…</p> : challenges.isError ? <p className="notice notice--bad" role="alert">{challenges.error.message}</p> : !puzzle ? <p>No Puzzle Blueprint is assigned to the current campaign.</p> : <><p><strong>{puzzle.name}</strong></p><p>{puzzle.family} · {puzzle.difficultyTier} · generator version {puzzle.generatorVersion}</p>{puzzle.acceptance ? <><p className="notice notice--good" role="timer">{remainingSeconds} seconds remaining</p><p>Accepted {new Date(puzzle.acceptance.acceptedAt).toLocaleString()} · ends {new Date(puzzle.acceptance.endsAt).toLocaleString()}</p><ol>{puzzle.hints.map((hint) => <li key={hint.level}><strong>{hint.kind}</strong>: {hint.template}</li>)}</ol></> : <><p>The acceptance action starts the exact 2,160,000-second challenge window. It does not begin while this warning is merely viewed.</p><button className="button button--gold" disabled={busy} onClick={async () => { setBusy(true); setMessage(""); const response = await fetch("/api/player/puzzles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ generatorVersion: puzzle.generatorVersion, puzzleBlueprintId: puzzle.puzzleBlueprintId }) }); const result = await response.json() as { error?: string }; setBusy(false); setMessage(response.ok ? "Challenge accepted." : result.error ?? "Challenge acceptance failed."); if (response.ok) await challenges.refetch(); }}>{busy ? "Accepting…" : "Accept challenge"}</button></>}{message && <p className="notice" role="status">{message}</p>}</>}<div className="action-row"><a className="button" href="/game">Return to game</a></div></section></>;
}

function Companions({ screen }: { screen: PageManifestEntry }) {
  return <><GameHead title={screen.title} description="Current player-visible companion group and selected companion details." /><div className="grid-2"><section className="card"><h2>Companion group</h2><p>No player-visible Companion records are available.</p></section><section className="card"><h2>Companion details</h2><p>No Companion is selected.</p></section></div><p className="notice notice--warn">Companion identities, health, relationships, and Heirloom details require player-runtime source rows. Internal story structure is not projected into this screen.</p></>;
}

function Calendar({ screen }: { screen: PageManifestEntry }) {
  const [monthIndex, setMonthIndex] = useState(0);
  const calendar = useQuery({ queryKey: ["player", "calendar"], queryFn: async () => { const response = await fetch("/api/player/calendar"); const result = await response.json() as { months?: Array<{ monthName: string; monthNumber: number; days: Array<{ calendarOrdinalId: string; dayOfMonth: number; weekdayName: string }> }> }; if (!response.ok || !result.months) throw new Error("Calendar ordinals could not be loaded."); return result.months; }, retry: false });
  const month = calendar.data?.[monthIndex];
  const countedWeekdays = month ? [...new Set(month.days.map((day) => day.weekdayName))] : Array.from({ length: calendarContract.countedWeekdays }, (_, index) => `Counted weekday ${index + 1}`);
  const monthDays = month?.days ?? Array.from({ length: calendarContract.daysPerMonth }, (_, index) => ({ calendarOrdinalId: `unavailable-${index + 1}`, dayOfMonth: index + 1, weekdayName: countedWeekdays[index % countedWeekdays.length]! }));
  const preYearDays = [25, 26, 27] as const;
  return <><GameHead title={screen.title} description="Authoritative persisted calendar ordinals and governed pre-year story days." /><section className="calendar">{calendar.isError && <p className="notice notice--bad" role="alert">{calendar.error.message}</p>}<header><button className="button" disabled={!month || monthIndex === 0} onClick={() => setMonthIndex((index) => index - 1)}>Previous</button><div><h2>{month?.monthName ?? (calendar.isPending ? "Loading month…" : "Month unavailable")}</h2><p>{calendarContract.monthsPerYear} months per year · {calendarContract.daysPerMonth} days per month</p></div><button className="button" disabled={!month || monthIndex === calendar.data!.length - 1} onClick={() => setMonthIndex((index) => index + 1)}>Next</button></header><div className="pre-year-days" aria-label="Pre-year story days"><h3>Pre-year story days</h3>{preYearDays.map((day) => <span key={day}>Yearsend {day}</span>)}</div><div className="calendar-grid" role="grid" aria-label="Calendar month">{countedWeekdays.map((day) => <strong key={day}>{day}</strong>)}{monthDays.map((day) => <span className="calendar-day" key={day.calendarOrdinalId}>{day.dayOfMonth}</span>)}</div><p className={`notice ${month ? "notice--good" : "notice--warn"}`}>{calendarContract.excludedWeekday} is hidden and excluded from the counted week. {month ? "Month and weekday names come from persisted CalendarOrdinal records." : "Exact weekday and month names require the authoritative CalendarOrdinal rows."}</p></section></>;
}

function SettingsOverlay({ screen }: { screen: PageManifestEntry }) {
  return <><RuntimeViewport screen={screen} /><div className="modal-backdrop game-modal"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="game-settings-title"><p className="kicker">SHARED SETTINGS</p><h2 id="game-settings-title">Settings</h2><p>The same persisted settings owner is used here, at <a href="/settings">/settings</a>, and in Account.</p><SettingsPanel closeHref="/game" /></section></div></>;
}

function SignedInGamePage({ screen }: { screen: PageManifestEntry }) {
  if (["GAME_HEALTH01_PARTY_HEALTH", "GAME_INN01_INN", "GAME_MTG01_MORNING_MEETING_V2", "GAME_MTG02_EVENING_MEETING_V2"].includes(screen.screenId) || screen.screenId.startsWith("GAME_INV01_") || screen.screenId.startsWith("GAME_LED01_") || screen.screenId.startsWith("GAME_BANK01_")) return <><RuntimeViewport screen={{ ...screen, screenId: "GAME001", title: "Game" }} /><GameplayOverlayForScreen screen={screen} /></>;
  if (["GAME001", "GAME008", "GAME009", "GAME010", "GAM001", "GAME_VIEW_FULL", "GAME_VIEW_NO_COUNTDOWN", "GAME_VIEW_SINGLE_EXIT"].includes(screen.screenId)) return <RuntimeViewport screen={screen} />;
  if (["GAME002", "GAME003", "GAME016", "GAM002"].includes(screen.screenId)) return <Knowledge screen={screen} />;
  if (["GAME004", "GAM003"].includes(screen.screenId)) return <Bookshelf screen={screen} />;
  if (["GAME005", "GAME006", "GAME007", "GAME013", "GAM004", "GAM005", "GAME_GLOBE_PRESENT", "GAME_GLOBE_TIMELINE"].includes(screen.screenId)) return <Maps screen={screen} />;
  if (screen.screenId === "GAME011") return <WitnessTrial screen={screen} />;
  if (screen.screenId === "GAME012") return <Companions screen={screen} />;
  if (screen.screenId === "GAME014") return <Calendar screen={screen} />;
  if (screen.screenId === "GAME015") return <SettingsOverlay screen={screen} />;
  return <><GameHead title="Game screen unavailable" description="This player screen is not registered." /><section className="game-deferred"><h2>No runtime projection</h2><p>No game workflow is inferred for an unknown screen.</p></section></>;
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
