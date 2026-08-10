import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { PublicShell } from "../../components/shells/Shells";
import { managedAssetUrl } from "../../content/managed-assets";
import { publicFeatures, inviteConsent } from "../../content/public";
import { canAccessAdministration, resolveAuthorizationRole } from "../../domain/authorization";
import { contactTopicDetails, contactTopicTokens, type ContactTopic } from "../../domain/contact";
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
  return <><div className="action-row"><a className="button" href="/">Back</a><a className="button" href="/">Home</a></div><PageHead eyebrow="Features" title="Nine ways Echoes plays differently." description="Explore the systems behind the world, conversation, challenges and story." /><section className="features-overview"><div className="video-panel"><video controls preload="metadata" src={managedAssetUrl("video.good-versus-evil")}>Your browser does not support the captioned feature video.</video><div><strong>What makes Echoes of Eidolon different?</strong><small>Captioned feature video</small></div></div><div className="feature-grid">{publicFeatures.map((feature) => <a className="feature-tile" href={`/features/${feature.slug}`} key={feature.slug}><img src={feature.image ?? feature.icon} alt="" /><h2>{feature.title}</h2><p>{feature.summary}</p><span>View feature →</span></a>)}</div></section></>;
}

function FeaturePage({ screen }: { screen: PageManifestEntry }) {
  const index = Math.max(0, publicFeatures.findIndex((feature) => feature.title === screen.title));
  const feature = publicFeatures[index] ?? publicFeatures[0]!;
  const featureMedia = feature.slug === "the-power-of-three"
    ? <video className="feature-scene__media" controls preload="metadata" src={managedAssetUrl("video.power-of-three")}>Your browser does not support the captioned Power of Three video.</video>
    : <img className="feature-scene__media" src={feature.image} alt="" />;
  return <><a className="back-link" href="/features">← All Features</a><PageHead eyebrow={feature.title} title={feature.title} description={feature.tagline} /><div className="feature-detail"><section className="feature-scene">{featureMedia}<img className="feature-scene__icon" src={feature.icon} alt="" /><div><h2>{feature.title}</h2><p>{feature.detail}</p></div></section><aside className="stack"><article className="card"><h2>What changes for the player</h2><p>{feature.playerChange}</p></article><article className="card"><h2>What it is not</h2><p>No generic MMO framing, no visible internal admin terminology, and no menu-driven substitute for the feature itself.</p></article><article className="card"><h2>See it in play</h2><p>Feature video and screenshots explain the idea without revealing late-story structure.</p></article></aside></div><div className="grid-2"><article className="card"><h2>In practice</h2><ul>{feature.practice.map((item) => <li key={item}>{item}</li>)}</ul></article><article className="card"><h2>Next</h2><p>Return to all nine features or continue to Gameplay for a broader view of how they work together.</p><div className="action-row"><a className="button" href="/features">All Features</a><a className="button button--gold" href="/gameplay">Gameplay</a></div></article></div></>;
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
  const notice = health.isPending
    ? "Checking monitored public services…"
    : health.isError
      ? health.error.message
      : "Status checks loaded. Each service reports only what is currently verified.";
  return <><PageHead eyebrow="Status" title="Game & Server Status" description="Current public service health, maintenance and release information." /><a className="button" href="/status/releases">Release Notes</a><p className={`notice ${health.isError ? "notice--bad" : ""}`} role="status">{notice}</p><div className="service-grid">{health.data?.services.map((service) => <article className="card service" key={service.name}><h2>{service.name}<span>{statusLabels[service.status]}</span></h2><p>{service.description}</p></article>)}</div><div className="grid-2"><article className="card"><h2>Planned maintenance</h2><p>No maintenance schedule source is configured.</p><span className="tag">Not monitored</span></article><article className="card"><h2>Current release</h2><p>No verified release source is configured.</p><a className="button" href="/status/releases">View Release Notes</a></article></div><article className="card"><h2>Recent incidents</h2><p>No incident source is configured.</p></article></>;
}

function ReleasesPage({ detail }: { detail: boolean }) {
  const unavailable = "No verified release-note or deployment-history source is configured. Version history and current-release claims are not fabricated.";
  if (detail) return <><a className="back-link" href="/status/releases">← Back to Release Notes</a><PageHead eyebrow="Status" title="Release Note Detail" description="Player-visible release information." /><div className="release-layout"><aside className="card"><h2>Release archive</h2><p>No verified year, month, or release entries are available.</p></aside><article className="card"><h2>Release notes unavailable</h2><p>{unavailable}</p>{["Summary", "Added", "Changed", "Fixed", "Known issues"].map((section) => <section key={section}><h3>{section}</h3><p>No verified content is available.</p></section>)}</article></div></>;
  return <><PageHead eyebrow="Status" title="Release Notes" description="Player-visible release information." /><div className="release-layout"><aside className="card"><h2>Release archive</h2><nav aria-label="Release archive by year and month"><p>No verified release years are available.</p></nav></aside><article className="card"><h2>Release notes unavailable</h2><p>{unavailable}</p><p>Selecting a release will show its Summary, Added, Changed, Fixed, and Known issues sections.</p></article></div></>;
}

function ContactPage() {
  const [topic, setTopic] = useState<ContactTopic | null>("GENERAL");
  const [complete, setComplete] = useState(false);
  return <><PageHead eyebrow="Contact" title="Contact Us" description="Choose the company topic that best matches your message." /><p className="notice"><strong>Player support messages should be sent from the Support tab, not this webform.</strong> <a href="/account/support">Go to Support</a></p><div className="contact-layout"><form className="card" onInput={(event) => setComplete(event.currentTarget.checkValidity())} onSubmit={(event) => event.preventDefault()}><h2>Company Contact</h2><input name="topic" type="hidden" value={topic ?? ""} /><div className="topics" role="group" aria-label="Company contact topic">{contactTopicTokens.map((token, index) => { const detail = contactTopicDetails[token]; const selected = token === topic; return <button aria-pressed={selected} aria-label={`${selected ? "Clear" : "Select"} ${detail.label}`} className={`topic topic--tone-${index % 8} ${selected ? "selected" : ""}`} type="button" onClick={() => setTopic(selected ? null : token)} key={token}><span>{detail.label}</span>{selected && <span aria-hidden="true">×</span>}</button>; })}</div><label className="field">Reply email<input className="input" type="email" placeholder="you@example.com" required /></label><label className="field">Message<textarea className="textarea" placeholder="Tell us what you need help with." required /></label><div className="action-row"><a className="button" href="/">Back</a><a className="button" href="/">Home</a><button className="button button--gold" disabled>Send unavailable</button></div>{!complete && <small>Complete the required fields.</small>}<p className="notice notice--warn">Company contact delivery is owner-deferred until a company-contact recipient and retention/routing contract are supplied. The support recipient is not reused.</p></form><aside className="card"><h2>Initial response targets</h2><table className="simple-table"><tbody>{contactTopicTokens.map((token) => <tr key={token}><td>{contactTopicDetails[token].label}</td><td>{contactTopicDetails[token].responseTarget}</td></tr>)}</tbody></table><p>These are acknowledgement targets, not guaranteed resolution times. Business days exclude weekends and company-observed holidays.</p></aside></div></>;
}

function LegalPage({ screen }: { screen: PageManifestEntry }) {
  if (screen.screenId === "PUB019") return <><PageHead eyebrow="Legal" title="Legal" description="Policies and terms for the public site, membership, donations and store." /><div className="legal-grid">{["Terms", "Privacy", "Cookies", "Accessibility", "Conduct", "Beta", "Membership", "Donations", "Store", "Shipping", "Returns", "IP & Fan Content", "AI Player Content", "Cultural Use & Research Corrections"].map((name) => <a className="card" href={`/legal/${name.toLowerCase().replaceAll(" & ", "-").replaceAll(" ", "-")}`} key={name}><h2>{name}</h2><span>Open document →</span></a>)}</div></>;
  return <><a className="back-link" href="/legal">← Legal</a><PageHead eyebrow="Legal document" title={screen.title.replace("Legal Document - ", "")} description="Current player-facing policy document." /><article className="paper"><h2>{screen.title.replace("Legal Document - ", "")}</h2><p>This implementation preserves the reviewed document task and navigation. Final legal prose requires owner-supplied approved copy.</p></article></>;
}

function DonationPage({ checkout, eligible }: { checkout?: boolean; eligible?: boolean }) {
  return <><PageHead eyebrow="Donation" title={checkout ? "Donation Checkout" : "Donate"} description={checkout ? "Donation payment remains separate from merchandise and shipping." : "Support Echoes of Eidolon without purchasing merchandise."} />{checkout ? <div className="checkout-layout"><section className="card"><h2>Donation amount</h2><label className="field">Amount in US dollars<input className="input" min="10" max="100" type="number" /></label><p>Eligible contributions range from $10 to $100. No amount is selected by default.</p><p>No merchandise order or shipping address is created.</p></section><aside className="card"><h2>Summary</h2><p>Donation <strong>Not selected</strong></p><p>Member time <strong>Calculated from the selected amount</strong></p><button className="button button--gold" disabled>Donate unavailable</button><p className="notice notice--warn">Stripe submission is blocked until participant eligibility, grant persistence, webhook idempotency, and receipt ownership are supplied.</p></aside></div> : <div className="grid-2"><article className="card"><h2>{eligible ? "Eligibility unavailable" : "Guest information"}</h2><p>{eligible ? "The reviewed eligible state does not prove that the current participant is eligible. No eligibility result is asserted without its grant owner." : "Sign in to begin an account-specific eligibility check when that owner is supplied."}</p><a className="button" href="/auth/sign-in">Sign in</a></article><article className="card"><h2>Separate from merchandise</h2><p>A donation does not create a merchandise order or shipping address.</p></article></div>}</>;
}

function InvitePage() {
  return <><PageHead eyebrow="Invitation" title="Request an Invite" description="Request access to Echoes of Eidolon." /><form className="form-card" onSubmit={(event) => event.preventDefault()}><label className="field">Email<input className="input" type="email" required /></label><label className="field">Why are you interested?<textarea className="textarea" required /></label><label className="check"><input type="checkbox" required /> {inviteConsent}</label><button className="button button--gold" disabled>Submit unavailable</button><p className="notice notice--warn">Invitation request persistence, private review, issuance, and redemption verification are owner-deferred.</p></form></>;
}

function SignedInHome() {
  const session = authClient.useSession();

  if (session.isPending) return <><PageHead eyebrow="Home" title="Checking account session." description="Account state is loading." /><p className="notice">Checking account session…</p></>;
  if (!session.data) return <><PageHead eyebrow="Home" title="Sign in required" description="A signed-in account is required for role-specific home content." /><a className="button button--gold" href="/auth/sign-in">Sign In</a></>;

  const role = resolveAuthorizationRole(true, session.data.user.role);
  if (role === "user") return <><PageHead eyebrow="Home" title="Welcome back." description="Your account is signed in." /><section className="card"><h2>User access</h2><p>The account role does not establish beta/player eligibility or membership benefits.</p></section></>;
  if (canAccessAdministration(role)) return <><PageHead eyebrow="Home" title="Welcome back." description="Your account authorization was verified." /><section className="card"><h2>{role === "owner" ? "Owner" : "Admin"} access</h2><p>Administrative access is available through the server-owned account role.</p><a className="button button--gold" href="/admin">Open Administration</a></section></>;
  return <><PageHead eyebrow="Home" title="Welcome back." description="Your account access level was verified." /><section className="card"><h2>Member access level</h2><p>This access level does not establish beta/player eligibility or a membership-benefit entitlement.</p><a className="button" href="/account">Open Account</a></section></>;
}

export function PublicPage({ screen }: { screen: PageManifestEntry }) {
  const content = useMemo(() => {
    if (screen.screenId === "PUB_HOME_ADMIN" || screen.screenId === "PUB_HOME_MEMBER") return <SignedInHome />;
    if (screen.screenId === "PUB002") return <FeaturesPage />;
    if (screen.screenId.startsWith("FEATURE_")) return <FeaturePage screen={screen} />;
    if (screen.screenId === "PUB003") return <GameplayPage />;
    if (screen.screenId === "PUB016") return <StatusPage />;
    if (screen.screenId === "PUB017" || screen.screenId === "PUB018") return <ReleasesPage detail={screen.screenId === "PUB018"} />;
    if (screen.screenId === "PUB015") return <ContactPage />;
    if (screen.screenId.startsWith("LEGAL") || screen.screenId === "PUB019") return <LegalPage screen={screen} />;
    if (screen.screenId === "PUB009") return <DonationPage checkout />;
    if (screen.screenId === "PUB020" || screen.screenId === "PUB021") return <DonationPage eligible={screen.screenId === "PUB021"} />;
    if (screen.screenId === "PUB023") return <InvitePage />;
    return <><PageHead eyebrow={screen.screenId} title={screen.title} description="Reviewed public task." /></>;
  }, [screen]);
  return <PublicShell><main className="public-page">{content}</main></PublicShell>;
}
