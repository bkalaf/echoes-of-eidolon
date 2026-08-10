import type { PageManifestEntry } from "../../lib/page-manifest";
import { AccountShell } from "../../components/shells/Shells";

function AccountHead({ screen, description }: { screen: PageManifestEntry; description: string }) {
  return <header className="workspace-page-head"><p className="kicker">ACCOUNT · {screen.screenId}</p><h1>{screen.title}</h1><p>{description}</p></header>;
}

function Profile({ screen }: { screen: PageManifestEntry }) {
  const modal = screen.screenId === "ACC002" || screen.screenId === "ACC003";
  return <><AccountHead screen={screen} description="Account identity and profile details." /><div className="split"><form className="card form-grid"><label className="field">Username<input className="input" value="player-one" readOnly /></label><label className="field">Email<input className="input" value="player@example.com" readOnly /></label><label className="field">Display name<input className="input" defaultValue="Player One" /></label><label className="field">Time zone<input className="input" defaultValue="America/Los_Angeles" /></label><button className="button button--gold">Save changes</button></form><aside className="card"><h2>Account</h2><p>Email changes require verification.</p><p>Username cannot be changed.</p><a className="button" href="/account/profile?state=ACC002">Change email</a><h3>Authorized sessions</h3><p>Review devices with active account sessions.</p></aside></div>{modal && <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true"><p className="kicker">CHANGE EMAIL</p><h2>{screen.screenId === "ACC003" ? "Verify the new email address." : "Change account email."}</h2>{screen.screenId === "ACC003" ? <><p>Verification code sent to <strong>new@example.com</strong>.</p><label className="field">Verification code<input className="input" defaultValue="654321" /></label><p>The current account email is unchanged until verification succeeds.</p></> : <><label className="field">New email<input className="input" type="email" /></label><label className="field">Current password<input className="input" type="password" /></label></>}<div className="action-row"><a className="button" href="/account/profile">Back</a>{screen.screenId === "ACC003" && <button className="button">Resend</button>}<button className="button button--gold">{screen.screenId === "ACC003" ? "Verify & Change Email" : "Send Verification"}</button></div></section></div>}</>;
}

const subscriptionStates: Record<string, { notice: string; tone?: string; action?: string }> = {
  ACC005: { notice: "No active subscription.", action: "Subscribe" },
  ACC006: { notice: "Payment accepted.", tone: "good", action: "Continue" },
  ACC007: { notice: "Card declined. No subscription change was made.", tone: "bad", action: "Try another card" },
  ACC008: { notice: "Subscription active.", tone: "good", action: "Manage subscription" },
  ACC009: { notice: "Confirm subscription cancellation.", tone: "bad", action: "Cancel subscription" },
  ACC010: { notice: "Subscription history.", action: "Download receipt" },
};

function Subscription({ screen }: { screen: PageManifestEntry }) {
  const state = subscriptionStates[screen.screenId] ?? subscriptionStates.ACC005!;
  return <><AccountHead screen={screen} description="Subscription status, billing state and history." /><p className={`notice notice--${state.tone ?? "warn"}`}>{state.notice}</p><div className="grid-2"><article className="card"><h2>Membership</h2><p>Current plan</p><p className="stat">{screen.screenId === "ACC008" ? "Active" : "Not subscribed"}</p><button className={`button ${state.tone === "bad" ? "button--danger" : "button--gold"}`}>{state.action}</button></article><article className="card"><h2>Payment</h2><div className="payment-element">Stripe Payment Element<small>Payment details are hosted by Stripe.</small></div></article></div></>;
}

function Orders({ screen }: { screen: PageManifestEntry }) {
  const detail = screen.screenId !== "ACC011";
  return <><AccountHead screen={screen} description="Merchandise orders and fulfillment status." />{detail ? <div className="split"><article className="card"><h2>Order EID-1042</h2><dl className="details"><dt>Status</dt><dd>In production</dd><dt>Total</dt><dd>$54.00</dd><dt>Delivery</dt><dd>Standard shipping</dd></dl>{screen.screenId === "ACC013" && <><h3>Return request</h3><label className="field">Reason<select className="select"><option>Wrong item</option><option>Damaged item</option></select></label><button className="button button--gold">Submit return request</button></>}</article><aside className="card"><h2>Fulfillment</h2><p>Printful production and shipping status is displayed separately from Stripe payment status.</p></aside></div> : <section className="card"><table className="data-table"><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th></tr></thead><tbody><tr><td><a href="/account/orders/EID-1042">EID-1042</a></td><td>August 8, 2026</td><td>In production</td><td>$54.00</td></tr></tbody></table></section>}</>;
}

function Settings({ screen }: { screen: PageManifestEntry }) {
  return <><AccountHead screen={screen} description="Accessibility, communication and account preferences." /><form className="card settings-list"><label><input type="checkbox" defaultChecked /> Email notifications</label><label><input type="checkbox" defaultChecked /> Show explicit challenge countdowns</label><label><input type="checkbox" /> Reduce motion</label><label className="field">Text size<select className="select" defaultValue="Default"><option>Default</option><option>Large</option></select></label><button className="button button--gold">Save settings</button></form></>;
}

function Progress({ screen }: { screen: PageManifestEntry }) {
  const noCountdown = screen.screenId === "ACC017";
  return <><AccountHead screen={screen} description="Current campaign progress and explicit challenge timing." /><div className="grid-3"><article className="card"><h2>Current book</h2><p className="stat">Book 1</p><p>Opening journey</p></article><article className="card"><h2>Knowledge</h2><p className="stat">18</p><p>Items discovered</p></article><article className="card"><h2>Challenge countdown</h2><p className="stat">{noCountdown ? "None" : "02:14:32"}</p><p>{noCountdown ? "No current countdown." : "An accepted timed challenge is active."}</p></article></div></>;
}

function Achievements({ screen }: { screen: PageManifestEntry }) {
  return <><AccountHead screen={screen} description="Unlocked and discoverable achievements." /><div className="grid-3">{["First Steps", "Careful Listener", "Source Checked"].map((name, index) => <article className="card" key={name}><span className={`tag ${index < 2 ? "tag--good" : ""}`}>{index < 2 ? "UNLOCKED" : "LOCKED"}</span><h2>{name}</h2><p>{index < 2 ? "Earned during current play." : "Requirements remain undisclosed."}</p></article>)}</div></>;
}

function Support({ screen }: { screen: PageManifestEntry }) {
  if (screen.screenId === "ACC020") return <><AccountHead screen={screen} description="Create a help ticket." /><form className="form-card"><label className="field">Topic<select className="select"><option>Account</option><option>Game</option><option>Store order</option></select></label><label className="field">Subject<input className="input" /></label><label className="field">Description<textarea className="textarea" /></label><button className="button button--gold">Create ticket</button></form></>;
  if (screen.screenId === "ACC021") return <><AccountHead screen={screen} description="Help ticket detail and replies." /><div className="split"><article className="card"><h2>Ticket TKT-0042</h2><p>Account access question</p><span className="tag">OPEN</span><label className="field">Reply<textarea className="textarea" /></label><button className="button button--gold">Send reply</button></article><aside className="card"><h2>History</h2><p>Created August 8, 2026</p><p>Awaiting support response</p></aside></div></>;
  return <><AccountHead screen={screen} description="Help tickets and support responses." /><section className="card"><a className="button button--gold" href="/account/support/new">Create help ticket</a><table className="data-table"><thead><tr><th>Ticket</th><th>Subject</th><th>Status</th></tr></thead><tbody><tr><td><a href="/account/support/TKT-0042">TKT-0042</a></td><td>Account access question</td><td>Open</td></tr></tbody></table></section></>;
}

function Invitations({ screen }: { screen: PageManifestEntry }) {
  const pending = screen.screenId === "ACC023";
  return <><AccountHead screen={screen} description="Request an invitation for another participant." /><section className="form-card">{pending ? <><p className="notice notice--warn">Invitation request pending.</p><p>The request will remain here until it is approved or declined.</p></> : <form><label className="field">Email<input className="input" type="email" /></label><label className="field">Message<textarea className="textarea" /></label><button className="button button--gold">Request invite</button></form>}</section></>;
}

function BetaLanding({ screen }: { screen: PageManifestEntry }) {
  return <><AccountHead screen={screen} description="Approval state: AUTHENTICATED" /><div className="checkout-layout"><section className="card"><p className="kicker">BETA</p><h2>Beta is Invite Only</h2><p>Your account is participating in the current beta. USER and MEMBER have the same beta-access status.</p><p className="notice">Optional membership changes configured perks; it does not purchase participation.</p><div className="action-row"><a className="button button--gold" href="/game">Continue Game</a><a className="button" href="/status/releases">Release Notes</a></div></section><form className="card form-stack"><h2>Invite a friend</h2><p>You may request an invitation for someone you know. Requests enter the admin review queue.</p><label className="field">Name<input className="input" defaultValue="Friend name" /></label><label className="field">Email<input className="input" type="email" defaultValue="friend@example.com" /></label><label className="field">Reason<input className="input" defaultValue="Why should they join?" /></label><button className="button">Request invite</button></form></div><article className="card import-preview"><h2>What's new in 0.2.0</h2><p>Read release notes without exposing unrevealed story details.</p></article></>;
}

export function AccountPage({ screen }: { screen: PageManifestEntry }) {
  let page;
  if (screen.screenId === "ACC030") page = <BetaLanding screen={screen} />;
  else if (["ACC001", "ACC002", "ACC003", "ACC004"].includes(screen.screenId)) page = <Profile screen={screen} />;
  else if (screen.screenId >= "ACC005" && screen.screenId <= "ACC010") page = <Subscription screen={screen} />;
  else if (["ACC011", "ACC012", "ACC013"].includes(screen.screenId)) page = <Orders screen={screen} />;
  else if (["ACC014", "ACC015"].includes(screen.screenId)) page = <Settings screen={screen} />;
  else if (["ACC016", "ACC017"].includes(screen.screenId)) page = <Progress screen={screen} />;
  else if (screen.screenId === "ACC018") page = <Achievements screen={screen} />;
  else if (["ACC019", "ACC020", "ACC021"].includes(screen.screenId)) page = <Support screen={screen} />;
  else page = <Invitations screen={screen} />;
  return <AccountShell>{page}</AccountShell>;
}
