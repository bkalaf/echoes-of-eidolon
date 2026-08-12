import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { PublicShell } from "../../components/shells/Shells";
import { MarkdownDocument } from "../../components/MarkdownDocument";
import { RegionCrest } from "../../components/RegionCrest";
import { featureCrestPresentation } from "../../content/feature-crests";
import { legalDocumentForScreen, legalDocuments, legalDocumentStatus, legalPublicationStatus } from "../../content/legal-documents";
import { managedAssetUrl } from "../../content/managed-assets";
import { publicFeatures, inviteConsent } from "../../content/public";
import publicReleaseNotes from "../../data/public-release-notes.generated.json";
import { canAccessAdministration, resolveAuthorizationRole } from "../../domain/authorization";
import { contactTopicDetails, contactTopicTokens, type ContactTopic } from "../../domain/contact";
import { donationMonths } from "../../domain/membership";
import type { ReleaseNotes } from "../../domain/release-notes";
import { authClient } from "../../lib/auth-client";
import type { PageManifestEntry } from "../../lib/page-manifest";
import type { PublicHealthReport, ServiceHealthStatus } from "../../server/health";

const gameplaySteps = [
  ["Go somewhere worth investigating", "Use maps, routes and what you have learned to decide where to spend your time."],
  ["Talk naturally", "Speak or type your own questions. Characters answer from their own knowledge and perspective."],
  ["Build understanding", "Your Knowledge Base grows as you discover people, places, books, history and connections."],
  ["Accept a challenge when you are ready", "Optional timed challenges begin deliberately, not because the game happened to load a screen."],
] as const;

function PageHead({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="page-head"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>;
}

function FeaturesPage() {
  return <><div className="action-row"><a className="button" href="/">Back</a><a className="button" href="/">Home</a></div><PageHead eyebrow="Features" title="Nine ways Echoes plays differently." description="Explore the systems behind the world, conversation, challenges and story." /><section className="features-overview"><div className="video-panel video-panel--features"><video controls preload="metadata" src={managedAssetUrl("video.power-of-three")}>Your browser does not support the captioned feature video.</video><div className="video-caption"><strong>What makes Echoes of Eidolon different?</strong><small>Captioned feature video</small></div></div><div className="feature-grid">{publicFeatures.map((feature) => <a className="feature-tile" href={`/features/${feature.slug}`} key={feature.slug}><RegionCrest {...featureCrestPresentation(feature.slug)} /><div><h2>{feature.title}</h2><p>{feature.summary}</p><span>View feature →</span></div></a>)}</div></section></>;
}

const featureSlugByScreenId: Record<string, string> = {
  FEATURE_01: "a-living-world",
  FEATURE_02: "forge-your-path",
  FEATURE_03: "real-challenges",
  FEATURE_04: "leave-your-mark",
  FEATURE_05: "the-power-of-three",
  FEATURE_06: "truth-still-matters",
  FEATURE_07: "real-life-comes-first",
  FEATURE_08: "speak-or-type-freely",
  FEATURE_09: "a-unique-and-powerful-story",
};

function FeaturePage({ screen }: { screen: PageManifestEntry }) {
  const slug = featureSlugByScreenId[screen.screenId];
  const feature = publicFeatures.find((entry) => entry.slug === slug);
  if (!feature) return <><PageHead eyebrow="Features" title="Feature unavailable" description="This feature screen is not registered." /><p className="notice notice--warn">No feature content is inferred for an unknown screen.</p></>;
  const featureMedia = feature.slug === "the-power-of-three"
    ? <video className="feature-scene__media" controls preload="metadata" src={managedAssetUrl("video.power-of-three")}>Your browser does not support the captioned Power of Three video.</video>
    : <img className="feature-scene__media" src={feature.image} alt="" />;
  return <><a className="back-link" href="/features">← All Features</a><PageHead eyebrow={feature.title} title={feature.title} description={feature.tagline} /><div className="feature-detail"><section className="feature-scene">{featureMedia}<RegionCrest className="feature-scene__icon" {...featureCrestPresentation(feature.slug)} /><div><h2>{feature.title}</h2><p>{feature.detail}</p></div></section><aside className="stack"><article className="card"><h2>What changes for the player</h2><p>{feature.playerChange}</p></article><article className="card"><h2>What it is not</h2><p>No generic MMO framing, no visible internal admin terminology, and no menu-driven substitute for the feature itself.</p></article><article className="card"><h2>See it in play</h2><p>Feature video and screenshots explain the idea without revealing late-story structure.</p></article></aside></div><div className="grid-2"><article className="card"><h2>In practice</h2><ul>{feature.practice.map((item) => <li key={item}>{item}</li>)}</ul></article><article className="card"><h2>Next</h2><p>Return to all nine features or continue to Gameplay for a broader view of how they work together.</p><div className="action-row"><a className="button" href="/features">All Features</a><a className="button button--gold" href="/gameplay">Gameplay</a></div></article></div></>;
}

function GameplayPage() {
  return <><PageHead eyebrow="Gameplay" title="Explore. Ask. Learn. Decide." description="The core loop is investigation inside a persistent world, not a chain of dialogue menus." /><div className="gameplay-layout"><section className="video-panel"><video controls preload="metadata" src={managedAssetUrl("video.year-zero-law")}>Your browser does not support the captioned gameplay video.</video><div><strong>How Echoes plays</strong><small>Captioned video: how the Year Zero law unites Eidolon.</small></div></section><section className="step-list">{gameplaySteps.map(([title, body], index) => <article className="step" key={title}><span>{index + 1}</span><div><h2>{title}</h2><p>{body}</p></div></article>)}</section></div></>;
}

async function fetchHealth(): Promise<PublicHealthReport> {
  const response = await fetch("/api/health");
  if (!response.ok) throw new Error("Service health could not be loaded.");
  return response.json() as Promise<PublicHealthReport>;
}

const statusLabels: Record<ServiceHealthStatus, string> = {
  operational: "Operational",
  configured: "Configured",
  unavailable: "Unavailable",
  unmonitored: "Not monitored",
};

function StatusPage() {
  const health = useQuery({ queryKey: ["public-health"], queryFn: fetchHealth });
  const releases = useQuery({
    queryKey: ["public-releases"],
    queryFn: async () => {
      const response = await fetch("/api/releases");
      if (!response.ok) throw new Error("Current release could not be loaded.");
      return response.json() as Promise<{ currentVersion: string; releases: ReleaseNotes[] }>;
    },
  });
  const latestRelease = releases.data?.releases[0];
  const notice = health.isPending
    ? "Checking monitored public services…"
    : health.isError
      ? health.error.message
      : "Status checks loaded. Each service reports only what is currently verified.";
  return <><PageHead eyebrow="Status" title="Game & Server Status" description="Current public service health, maintenance and release information." /><a className="button" href="/status/releases">Release Notes</a><p className={`notice ${health.isError ? "notice--bad" : ""}`} role="status">{notice}</p><div className="service-grid">{health.data?.services.map((service) => <article className="card service" key={service.name}><h2>{service.name}<span>{statusLabels[service.status]}</span></h2><p>{service.description}</p></article>)}</div><div className="grid-2"><article className="card"><h2>Planned maintenance</h2><p>No maintenance schedule source is configured.</p><span className="tag">Not monitored</span></article><article className="card"><h2>Current release</h2><p><strong>Application version {publicReleaseNotes.currentVersion}</strong></p>{releases.isPending ? <p>Loading current release…</p> : releases.isError ? <p className="notice notice--bad">{releases.error.message}</p> : latestRelease ? <><h3>{latestRelease.title}</h3><p>{latestRelease.summary}</p><small>Published {latestRelease.releaseDate}</small><p><a href={`/status/releases/${encodeURIComponent(latestRelease.version)}`}>Read current release notes</a></p></> : <p>No player-visible release has been published.</p>}<a className="button" href="/status/releases">View Release Notes</a></article></div><article className="card"><h2>Recent incidents</h2><p>No incident source is configured.</p></article></>;
}

function releaseVersionFromPath(pathname?: string): string | undefined {
  const encoded = pathname?.match(/^\/status\/releases\/([^/]+)$/)?.[1];
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}

function ReleasesPage({ detail, pathname }: { detail: boolean; pathname?: string }) {
  const releases = useQuery({
    queryKey: ["public-releases"],
    queryFn: async () => {
      const response = await fetch("/api/releases");
      if (!response.ok) throw new Error("Release notes could not be loaded.");
      return response.json() as Promise<{ currentVersion: string; releases: ReleaseNotes[] }>;
    },
  });
  const requestedVersion = detail ? releaseVersionFromPath(pathname) : undefined;
  const selected = detail
    ? releases.data?.releases.find((release) => release.version === requestedVersion)
    : releases.data?.releases[0];
  const selectedIndex = selected ? releases.data?.releases.findIndex((release) => release.version === selected.version) ?? -1 : -1;
  const previous = selectedIndex >= 0 ? releases.data?.releases[selectedIndex + 1] : undefined;
  const next = selectedIndex > 0 ? releases.data?.releases[selectedIndex - 1] : undefined;
  const detailBody = releases.isPending ? <p className="notice">Loading release notes…</p> : releases.isError ? <p className="notice notice--bad">{releases.error.message}</p> : detail && requestedVersion && !selected ? <p className="notice notice--bad" role="alert">Published release {requestedVersion} was not found.</p> : !selected ? <p className="notice">No player-visible release has been published.</p> : <article className="paper release-document"><div className="action-row action-row--between"><div><p className="kicker">Release {selected.version}</p><h2>{selected.title}</h2><small>Published {selected.releaseDate}</small></div>{detail && <nav className="action-row" aria-label="Adjacent release notes">{previous ? <a className="button" href={`/status/releases/${encodeURIComponent(previous.version)}`}>Previous</a> : <button className="button" disabled>Previous</button>}{next ? <a className="button" href={`/status/releases/${encodeURIComponent(next.version)}`}>Next</a> : <button className="button" disabled>Next</button>}</nav>}</div><p>{selected.summary}</p>{["ADDED", "CHANGED", "FIXED", "SECURITY", "KNOWN_ISSUE"].map((category) => { const items = selected.items.filter((item) => item.category === category); return items.length > 0 && <section key={category}><h3>{category.replaceAll("_", " ")}</h3>{items.map((item) => <article key={item.itemId}><h4>{item.title}</h4><MarkdownDocument source={item.body} /></article>)}</section>; })}</article>;
  const archive = releases.isPending ? <p className="notice">Loading release notes…</p> : releases.isError ? <p className="notice notice--bad">{releases.error.message}</p> : <section className="stack"><h2>Release archive</h2>{releases.data.releases.length === 0 ? <p className="notice">No player-visible release has been published.</p> : releases.data.releases.map((release) => <article className="card" key={release.version}><p className="kicker">Release {release.version}</p><h3>{release.title}</h3><p>{release.summary}</p><small>Published {release.releaseDate}</small><p><a className="button" href={`/status/releases/${encodeURIComponent(release.version)}`}>Read release notes</a></p></article>)}</section>;
  return <>{detail && <a className="back-link" href="/status/releases">← Back to Release Notes</a>}<PageHead eyebrow="Status" title={detail ? selected?.title ?? "Release Note Detail" : "Release Notes"} description="Player-visible release information from owner-reviewed canonical notes." />{detail ? <div className="release-layout"><aside className="card"><h2>Release archive</h2>{releases.data?.releases.map((release) => <p key={release.version}><a href={`/status/releases/${encodeURIComponent(release.version)}`}><strong>{release.version}</strong></a><br /><small>{release.releaseDate}</small></p>)}</aside>{detailBody}</div> : archive}</>;
}

function ContactPage() {
  const [topic, setTopic] = useState<ContactTopic | null>("GENERAL");
  const [complete, setComplete] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "received" | "error">("idle");
  const [result, setResult] = useState("");
  return <><PageHead eyebrow="Contact" title="Contact Us" description="Choose the company topic that best matches your message." /><p className="notice"><strong>Player support messages should be sent from the Support tab, not this webform.</strong> <a href="/account/support">Go to Support</a></p><div className="contact-layout"><form className="card" onInput={(event) => setComplete(event.currentTarget.checkValidity())} onSubmit={async (event) => { event.preventDefault(); if (!topic) return; setState("sending"); const data = new FormData(event.currentTarget); const response = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic, replyEmail: data.get("replyEmail"), message: data.get("message") }) }); const receipt = await response.json() as { delivery?: string; error?: string }; setResult(response.ok ? receipt.delivery === "delivered" ? "Your message was received and routed." : "Your message was received. Delivery is queued for operator configuration." : receipt.error ?? "Your message could not be received."); setState(response.ok ? "received" : "error"); }}><h2>Company Contact</h2><input name="topic" type="hidden" value={topic ?? ""} /><div className="topics" role="group" aria-label="Company contact topic">{contactTopicTokens.map((token, index) => { const detail = contactTopicDetails[token]; const selected = token === topic; return <button aria-pressed={selected} aria-label={`${selected ? "Clear" : "Select"} ${detail.label}`} className={`topic topic--tone-${index % 8} ${selected ? "selected" : ""}`} type="button" onClick={() => setTopic(selected ? null : token)} key={token}><span>{detail.label}</span>{selected && <span aria-hidden="true">×</span>}</button>; })}</div><label className="field">Reply email<input className="input" name="replyEmail" type="email" placeholder="you@example.com" required /></label><label className="field">Message<textarea className="textarea" name="message" minLength={10} placeholder="Tell us what you need help with." required /></label><div className="action-row"><a className="button" href="/">Back</a><a className="button" href="/">Home</a><button className="button button--gold" disabled={!complete || !topic || state === "sending"}>{state === "sending" ? "Sending…" : "Send message"}</button></div>{state !== "idle" && state !== "sending" && <p className={`notice ${state === "error" ? "notice--bad" : ""}`} role="status">{result}</p>}</form><aside className="card"><h2>Initial response targets</h2><table className="simple-table"><tbody>{contactTopicTokens.map((token) => <tr key={token}><td>{contactTopicDetails[token].label}</td><td>{contactTopicDetails[token].responseTarget}</td></tr>)}</tbody></table><p>These are acknowledgement targets, not guaranteed resolution times. Business days exclude weekends and company-observed holidays.</p></aside></div></>;
}

function LegalPage({ screen }: { screen: PageManifestEntry }) {
  if (screen.screenId === "PUB019") return <><PageHead eyebrow="Legal" title="Legal" description="The complete owner-approved 0.2.0 legal-content register. Approval does not authorize publication or deployment." /><p className="notice notice--good"><strong>{legalDocumentStatus}</strong></p><p className="notice notice--warn"><strong>{legalPublicationStatus}</strong></p><div className="legal-grid">{legalDocuments.map((document) => <a className="card" href={`/legal/${document.slug}`} key={document.screenId}><p className="kicker">{document.screenId} · OWNER APPROVED</p><h2>{document.title}</h2><span>Open document →</span></a>)}</div></>;
  const document = legalDocumentForScreen(screen.screenId);
  if (!document) return <p className="notice notice--bad" role="alert">The requested legal document is not registered.</p>;
  return <><a className="back-link" href="/legal">← Legal</a><PageHead eyebrow="Legal document · OWNER APPROVED" title={document.title} description="Owner-approved 0.2.0 text. This page is not published, legally effective, or authorized for production deployment." /><p className="notice notice--good"><strong>{legalDocumentStatus}</strong></p><p className="notice notice--warn"><strong>{legalPublicationStatus}</strong></p><article className="paper legal-document"><MarkdownDocument source={document.content} /></article></>;
}

function DonationLanding() {
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const [access, setAccess] = useState<{ canPlay: boolean; userId: string }>();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (!userId) return () => controller.abort();
    void fetch("/api/player/access", { signal: controller.signal }).then(async (response) => {
      const result = response.ok ? await response.json() as { canPlay?: unknown } : undefined;
      if (active) setAccess({ canPlay: result?.canPlay === true, userId });
    }).catch(() => {
      if (active) setAccess({ canPlay: false, userId });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [userId]);

  if (session.isPending) return <p className="notice">Checking account session…</p>;
  if (!session.data) return <div className="grid-2"><article className="card"><h2>Guest information</h2><p>Sign in to verify participant eligibility before donating.</p><a className="button" href="/auth/sign-in?returnTo=%2Fdonate">Sign in</a></article><article className="card"><h2>Separate from merchandise</h2><p>A donation does not create a merchandise order or shipping address.</p></article></div>;
  if (!access || access.userId !== userId) return <p className="notice">Checking donation eligibility…</p>;
  return <div className="grid-2"><article className="card"><h2>{access.canPlay ? "Eligible participant" : "Donation eligibility required"}</h2><p>{access.canPlay ? "Contributions from $10 to $100 add the calculated membership time after server-confirmed payment." : "This signed-in account is not currently eligible to contribute."}</p>{access.canPlay && <a className="button button--gold" href="/donate/checkout">Continue to donation checkout</a>}</article><article className="card"><h2>Separate from access</h2><p>Donation-granted membership never changes authorization role or beta/player eligibility.</p></article></div>;
}

function DonationPage({ checkout }: { checkout?: boolean }) {
  const [amount, setAmount] = useState("");
  const [paymentState, setPaymentState] = useState<"idle" | "starting" | "error">("idle");
  const amountCents = /^\d+(?:\.\d{1,2})?$/.test(amount) ? Math.round(Number(amount) * 100) : undefined;
  const months = amountCents !== undefined && amountCents >= 1_000 && amountCents <= 10_000
    ? donationMonths(amountCents)
    : undefined;
  return <><PageHead eyebrow="Donation" title={checkout ? "Donation Checkout" : "Donate"} description={checkout ? "Donation payment remains separate from merchandise and shipping." : "Support Echoes of Eidolon without purchasing merchandise."} />{checkout ? <div className="checkout-layout"><section className="card"><h2>Donation amount</h2><label className="field">Amount in US dollars<input className="input" min="10" max="100" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><p>Eligible contributions range from $10 to $100. No amount is selected by default.</p><p>No merchandise order or shipping address is created.</p></section><aside className="card"><h2>Summary</h2><p>Donation <strong>{amountCents === undefined ? "Not selected" : `$${(amountCents / 100).toFixed(2)}`}</strong></p><p>Member time <strong>{months === undefined ? "Select an eligible amount" : `+${months} ${months === 1 ? "month" : "months"}`}</strong></p><button className="button button--gold" disabled={months === undefined || paymentState === "starting"} onClick={async () => { setPaymentState("starting"); const response = await fetch("/api/donations/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amountCents }) }); const result = await response.json() as { checkoutUrl?: string }; if (response.ok && result.checkoutUrl) window.location.assign(result.checkoutUrl); else setPaymentState("error"); }}>{paymentState === "starting" ? "Opening Stripe…" : "Continue to secure payment"}</button>{paymentState === "error" && <p className="notice notice--bad" role="alert">Sign in with an eligible participant account and try again.</p>}<p className="notice">Membership is granted only after a signed Stripe confirmation is persisted.</p></aside></div> : <DonationLanding />}</>;
}

function InvitePage() {
  const session = authClient.useSession();
  const [state, setState] = useState<"idle" | "sending" | "received" | "error">("idle");
  return <><PageHead eyebrow="Invitation" title="Request an Invite" description="Request access to Echoes of Eidolon for a friend." />{!session.data && <p className="notice">You may review this form now; <a href="/auth/sign-in?returnTo=%2Frequest-invite">sign in</a> before submitting.</p>}<form className="form-card" onSubmit={async (event) => { event.preventDefault(); setState("sending"); const data = new FormData(event.currentTarget); const response = await fetch("/api/beta-invitations/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ friendName: data.get("friendName"), email: data.get("email"), reason: data.get("reason"), consent: data.get("consent") === "on" }) }); setState(response.ok ? "received" : "error"); }}><label className="field">Friend name<input className="input" name="friendName" required /></label><label className="field">Friend email<input className="input" name="email" type="email" required /></label><label className="field">Why should they be invited?<textarea className="textarea" name="reason" required /></label><label className="check"><input name="consent" type="checkbox" required /> {inviteConsent}</label><button className="button button--gold" disabled={!session.data || state === "sending"}>{state === "sending" ? "Submitting…" : "Submit request"}</button>{state === "received" && <p className="notice" role="status">Invitation request received for private review.</p>}{state === "error" && <p className="notice notice--bad" role="alert">The invitation request could not be submitted.</p>}</form></>;
}

function SignedInHome() {
  const session = authClient.useSession();

  if (session.isPending) return <><PageHead eyebrow="Home" title="Checking account session." description="Account state is loading." /><p className="notice">Checking account session…</p></>;
  if (!session.data) return <><PageHead eyebrow="Home" title="Sign in required" description="A signed-in account is required for role-specific home content." /><a className="button button--gold" href="/auth/sign-in">Sign In</a></>;

  const role = resolveAuthorizationRole(true, session.data.user.role);
  if (!role) return <><PageHead eyebrow="Home" title="Authorization unavailable" description="The stored account role is not registered." /><section className="card"><p>No access level or capability is inferred from an unknown role.</p></section></>;
  if (role === "user") return <><PageHead eyebrow="Home" title="Welcome back." description="Your account is signed in." /><section className="card"><h2>User access</h2><p>The account role does not establish beta/player eligibility or membership benefits.</p><a className="button" href="/status/releases">Release Notes</a></section></>;
  if (canAccessAdministration(role)) return <><PageHead eyebrow="Home" title="Welcome back." description="Your account authorization was verified." /><section className="card"><h2>{role === "owner" ? "Owner" : "Admin"} access</h2><p>Administrative access is available through the server-owned account role.</p><div className="action-row"><a className="button button--gold" href="/admin">Open Administration</a><a className="button" href="/status/releases">Release Notes</a></div></section></>;
  if (role === "member") return <><PageHead eyebrow="Home" title="Welcome back." description="Your account access level was verified." /><section className="card"><h2>Member access level</h2><p>This access level does not establish beta/player eligibility or a membership-benefit entitlement.</p><div className="action-row"><a className="button" href="/account">Open Account</a><a className="button" href="/status/releases">Release Notes</a></div></section></>;
  return <><PageHead eyebrow="Home" title="Authorization unavailable" description="No supplied account access level matched." /></>;
}

export function PublicPage({ pathname, screen }: { pathname?: string; screen: PageManifestEntry }) {
  const content = useMemo(() => {
    if (screen.screenId === "PUB_HOME_ADMIN" || screen.screenId === "PUB_HOME_MEMBER") return <SignedInHome />;
    if (screen.screenId === "PUB002") return <FeaturesPage />;
    if (screen.screenId.startsWith("FEATURE_")) return <FeaturePage screen={screen} />;
    if (screen.screenId === "PUB003") return <GameplayPage />;
    if (screen.screenId === "PUB016") return <StatusPage />;
    if (screen.screenId === "PUB017" || screen.screenId === "PUB018") return <ReleasesPage detail={screen.screenId === "PUB018"} pathname={pathname} />;
    if (screen.screenId === "PUB015") return <ContactPage />;
    if (screen.screenId.startsWith("LEGAL") || screen.screenId === "PUB019") return <LegalPage screen={screen} />;
    if (screen.screenId === "PUB009") return <DonationPage checkout />;
    if (screen.screenId === "PUB020" || screen.screenId === "PUB021") return <DonationPage />;
    if (screen.screenId === "PUB023") return <InvitePage />;
    return <><PageHead eyebrow={screen.screenId} title={screen.title} description="Reviewed public task." /></>;
  }, [pathname, screen]);
  return <PublicShell><main className="public-page">{content}</main></PublicShell>;
}
