import { useMemo, useState } from "react";
import type { PageManifestEntry } from "../../lib/page-manifest";
import { PublicShell } from "../../components/shells/Shells";
import { publicFeatures, inviteConsent } from "../../content/public";

const gameplaySteps = [
  ["Go somewhere worth investigating", "Use maps, routes and what you have learned to decide where to spend your time."],
  ["Talk naturally", "Speak or type your own questions. Characters answer from their own knowledge and perspective."],
  ["Build understanding", "Your Knowledge Base grows as you discover records, testimony and contradictions."],
  ["Choose what matters", "Decisions affect relationships, access, knowledge and later opportunities."],
] as const;

const services = [
  ["Website", "Public site and account access"],
  ["Authentication", "Sign in, invitations and account access"],
  ["Game Service", "Player runtime and progression"],
  ["Store", "Merchandise browsing and checkout"],
] as const;

function PageHead({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="page-head"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>;
}

function FeaturesPage() {
  return <><PageHead eyebrow="Features" title="Nine ways Echoes plays differently." description="Explore the systems behind the world, conversation, challenges and story." /><section className="features-overview"><div className="video-panel"><img src="/assets/feature_video_clean.jpg" alt="" /><span className="play" aria-hidden="true">▶</span><div><strong>What makes Echoes of Eidolon different?</strong><small>Feature overview video</small></div></div><div className="feature-grid">{publicFeatures.map((feature) => <a className="feature-tile" href={`/features/${feature.slug}`} key={feature.slug}><img src={feature.icon} alt="" /><h2>{feature.title}</h2><p>{feature.summary}</p><span>View feature →</span></a>)}</div></section></>;
}

function FeaturePage({ screen }: { screen: PageManifestEntry }) {
  const index = Math.max(0, publicFeatures.findIndex((feature) => feature.title === screen.title));
  const feature = publicFeatures[index] ?? publicFeatures[0]!;
  const scene = `/assets/feature_scene_0${(index % 4) + 1}.jpg`;
  return <><a className="back-link" href="/features">← All Features</a><PageHead eyebrow={feature.title} title={feature.title} description={feature.tagline} /><div className="feature-detail"><section className="feature-scene"><img className="feature-scene__media" src={scene} alt="" /><img className="feature-scene__icon" src={feature.icon} alt="" /><div><h2>{feature.title}</h2><p>{feature.detail}</p></div></section><aside className="stack"><article className="card"><h2>What changes for the player</h2><p>{feature.playerChange}</p></article><article className="card"><h2>What it is not</h2><p>No generic MMO framing, no visible internal admin terminology, and no menu-driven substitute for the feature itself.</p></article><article className="card"><h2>See it in play</h2><p>Feature video and screenshots explain the idea without revealing late-story structure.</p><button className="button">Play Overview</button></article></aside></div><div className="grid-2"><article className="card"><h2>In practice</h2><ul>{feature.practice.map((item) => <li key={item}>{item}</li>)}</ul></article><article className="card"><h2>Next</h2><p>Return to all nine features or continue to Gameplay for a broader view of how they work together.</p><div className="action-row"><a className="button" href="/features">All Features</a><a className="button button--gold" href="/gameplay">Gameplay</a></div></article></div></>;
}

function GameplayPage() {
  return <><PageHead eyebrow="Gameplay" title="Explore. Ask. Learn. Decide." description="The core loop is investigation inside a persistent world, not a chain of dialogue menus." /><div className="gameplay-layout"><section className="video-panel"><img src="/assets/feature_video_clean.jpg" alt="" /><span className="play">▶</span><div><strong>How Echoes plays</strong><small>Travel, conversation, knowledge and challenges in one continuous experience.</small></div></section><section className="step-list">{gameplaySteps.map(([title, body], index) => <article className="step" key={title}><span>{index + 1}</span><div><h2>{title}</h2><p>{body}</p></div></article>)}</section></div></>;
}

function StatusPage() {
  return <><PageHead eyebrow="Status" title="Game & Server Status" description="Current public service health, maintenance and release information." /><a className="button" href="/status/releases">Release Notes</a><p className="notice notice--good">All monitored public services are operational.</p><div className="service-grid">{services.map(([name, description]) => <article className="card service" key={name}><h2>{name}<span>Operational</span></h2><p>{description}</p></article>)}</div><div className="grid-2"><article className="card"><h2>Planned maintenance</h2><p>No maintenance window is currently scheduled.</p><span className="tag">No active maintenance</span></article><article className="card"><h2>Current release</h2><p className="stat">0.2.0</p><a className="button" href="/status/releases">View Release Notes</a></article></div></>;
}

function ReleasesPage({ detail }: { detail: boolean }) {
  return <><PageHead eyebrow="Status" title={detail ? "Release Note Detail" : "Release Notes"} description="Browse player-visible releases by year and month." /><div className="release-layout"><aside className="card"><h2>2026</h2><strong>August</strong><a className="release selected" href="/status/releases/0.2.0">v0.2.0 · Current</a><span className="release">v0.1.9</span><strong>July</strong><span className="release">v0.1.8</span></aside><article className="card notes"><span className="tag tag--good">CURRENT</span><h2>v0.2.0</h2><p>Public site, account, merchandise, Atlas Manager and game-shell work.</p><h3>Highlights</h3><ul><li>New nine-card landing carousel and feature pages.</li><li>Updated account profile, settings, progress and support flows.</li><li>Stripe payment boundaries and Printful fulfillment separation.</li><li>Atlas Manager 2D map and 3D globe views.</li></ul></article></div></>;
}

function ContactPage() {
  const [topic, setTopic] = useState("General company inquiry");
  const [complete, setComplete] = useState(false);
  const topics = ["General company inquiry", "Press and media", "Business partnerships and licensing", "Accessibility feedback", "Privacy and data-rights inquiry", "Legal notice", "Security report", "Historical/cultural correction or sourcing concern"];
  const targets = [["General company inquiry", "5 business days"], ["Press and media", "2 business days"], ["Business partnerships and licensing", "7 business days"], ["Accessibility feedback", "3 business days"], ["Privacy and data-rights inquiry", "3 business days acknowledgement"], ["Legal notice", "3 business days acknowledgement"], ["Security report", "2 business days acknowledgement"], ["Historical/cultural correction", "5 business days acknowledgement; review update within 15"]];
  return <><PageHead eyebrow="Contact" title="Contact Us" description="Choose the company topic that best matches your message." /><p className="notice">Player support messages should be sent from the Support tab, not this webform. <a href="/account/support">Go to Support</a></p><div className="contact-layout"><form className="card" onInput={(event) => setComplete(event.currentTarget.checkValidity())}><h2>Company Contact</h2><div className="topics">{topics.map((item) => <button className={`topic ${item === topic ? "selected" : ""}`} type="button" onClick={() => setTopic(item)} key={item}>{item}</button>)}</div><label className="field">Reply email<input className="input" type="email" placeholder="you@example.com" required /></label><label className="field">Message<textarea className="textarea" placeholder="Tell us what you need help with." required /></label><div className="action-row"><a className="button" href="/">Back</a><a className="button" href="/">Home</a><button className="button button--gold" disabled={!complete}>Send Message</button></div>{!complete && <small>Complete the required fields to send.</small>}</form><aside className="card"><h2>Initial response targets</h2><table className="simple-table"><tbody>{targets.map(([name, target]) => <tr key={name}><td>{name}</td><td>{target}</td></tr>)}</tbody></table><p>These are acknowledgement targets, not guaranteed resolution times. Business days exclude weekends and company-observed holidays.</p></aside></div></>;
}

function LegalPage({ screen }: { screen: PageManifestEntry }) {
  if (screen.screenId === "PUB019") return <><PageHead eyebrow="Legal" title="Legal" description="Policies and terms for the public site, membership, donations and store." /><div className="legal-grid">{["Terms", "Privacy", "Cookies", "Accessibility", "Conduct", "Beta", "Membership", "Donations", "Store", "Shipping", "Returns", "IP & Fan Content", "AI Player Content", "Cultural Use & Research Corrections"].map((name) => <a className="card" href={`/legal/${name.toLowerCase().replaceAll(" & ", "-").replaceAll(" ", "-")}`} key={name}><h2>{name}</h2><span>Open document →</span></a>)}</div></>;
  return <><a className="back-link" href="/legal">← Legal</a><PageHead eyebrow="Legal document" title={screen.title.replace("Legal Document - ", "")} description="Current player-facing policy document." /><article className="paper"><h2>{screen.title.replace("Legal Document - ", "")}</h2><p>This implementation preserves the reviewed document task and navigation. Final legal prose requires owner-supplied approved copy.</p></article></>;
}

function DonationPage({ checkout, eligible }: { checkout?: boolean; eligible?: boolean }) {
  return <><PageHead eyebrow="Donation" title={checkout ? "Donation Checkout" : "Donate"} description={checkout ? "Stripe-hosted secure payment fields. No merchandise order or shipping address is created." : "Support Echoes of Eidolon without purchasing merchandise."} />{checkout ? <div className="checkout-layout"><section className="card"><h2>Donation amount</h2><div className="action-row">{["$10", "$25", "$50", "$100", "Other"].map((amount) => <button className="button" key={amount}>{amount}</button>)}</div><div className="payment-element">Stripe Payment Element<small>Card, Link, supported wallets, billing details.</small></div></section><aside className="card"><h2>Summary</h2><p>Donation <strong>$50.00</strong></p><p>Member time <strong>+6 months</strong></p><button className="button button--gold">Donate $50</button></aside></div> : <div className="grid-2"><article className="card"><h2>{eligible ? "Eligible participant" : "Guest information"}</h2><p>{eligible ? "Your account is eligible for donation-linked member time." : "Sign in to see account-specific eligibility before continuing."}</p><a className="button button--gold" href={eligible ? "/donate/checkout" : "/auth/sign-in"}>{eligible ? "Continue to donation" : "Sign in"}</a></article><article className="card"><h2>Separate from merchandise</h2><p>A donation does not create a merchandise order or shipping address.</p></article></div>}</>;
}

function InvitePage() {
  return <><PageHead eyebrow="Invitation" title="Request an Invite" description="Request access to Echoes of Eidolon." /><form className="form-card"><label className="field">Email<input className="input" type="email" required /></label><label className="field">Why are you interested?<textarea className="textarea" required /></label><label className="check"><input type="checkbox" required /> {inviteConsent}</label><button className="button button--gold">Submit request</button></form></>;
}

function SignedInHome({ member }: { member: boolean }) {
  return <><PageHead eyebrow="Home" title="Welcome back." description={member ? "Your beta access, membership benefits, and current release." : "Private beta access, current release notes, and invitation tools."} /><div className="grid-3"><article className="card"><h2>{member ? "Continue your story" : "Beta access"}</h2><span className="tag">{member ? "MEMBER" : "ADMIN"}</span><p>{member ? "Return to your current book and location without losing your session." : "Your account can enter the current beta build. Returning home keeps your session active."}</p><a className="button button--gold" href="/game">{member ? "Continue" : "Enter Echoes"}</a></article><article className="card"><h2>Current release</h2><p className="stat">0.2.0</p><p>{member ? "See what changed in the current public release notes." : "Read the latest player-facing changes before entering the game."}</p><a className="button" href="/status/releases">{member ? "View Release Notes" : "Release Notes"}</a></article><article className="card"><h2>{member ? "Membership" : "Invite a friend"}</h2><p>{member ? "Your active membership extends the configured voice window. Text interaction remains available without that time window." : "Request an invitation for someone you know. Approval happens privately; the requester is not shown an internal review state."}</p><a className="button" href={member ? "/account/subscription" : "/account/invitations/request"}>{member ? "View Membership" : "Request an Invite"}</a></article></div></>;
}

export function PublicPage({ screen }: { screen: PageManifestEntry }) {
  const content = useMemo(() => {
    if (screen.screenId === "PUB_HOME_ADMIN" || screen.screenId === "PUB_HOME_MEMBER") return <SignedInHome member={screen.screenId === "PUB_HOME_MEMBER"} />;
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
