import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AccountShell } from "../../components/shells/Shells";
import { SettingsPanel } from "../../components/SettingsPanel";
import { OtpInput } from "../../components/ui/controls";
import { subscriptionPriceCents } from "../../domain/membership";
import type { MembershipGrantSource } from "../../generated/prisma/enums";
import { authClient } from "../../lib/auth-client";
import type { PageManifestEntry } from "../../lib/page-manifest";

interface AccountUser {
  displayUsername?: string | null;
  email: string;
  name: string;
  username?: string | null;
}

interface AccountSession {
  expiresAt: Date | string;
  ipAddress?: string | null;
  isCurrent: boolean;
  sessionId: string;
  updatedAt: Date | string;
  userAgent?: string | null;
}

interface MembershipProjection {
  active: boolean;
  activePerks: Array<{ description: string; name: string; perkId: string }>;
  effectiveEndAt: string | null;
  grants: Array<{
    effectiveEndAt: string;
    effectiveStartAt: string;
    membershipGrantId: string;
    monthsGranted: number;
    source: MembershipGrantSource;
  }>;
  voiceWindowSeconds: number;
}

interface PlayerAccessProjection {
  betaEligible: boolean;
  canPlay: boolean;
  membershipEntitled: boolean;
  role: string;
  voiceWindowSeconds: number;
}

interface AccountOrderProjection {
  createdAt: string;
  lines: Array<{
    color: string | null;
    name: string;
    orderLineId: string;
    quantity: number;
    size: string | null;
    storeVariantId: string;
    unitPriceCents: number;
  }>;
  orderId: string;
  payment: null | {
    amountCents: number;
    confirmedAt: string;
    fulfillmentSubmittedAt: string | null;
  };
  refunds: Array<{ amountCents: number; refundedAt: string }>;
  returnEligibleAt: string | null;
}

function AccountHead({ screen, description }: { screen: PageManifestEntry; description: string }) {
  return <header className="workspace-page-head"><p className="kicker">ACCOUNT · {screen.screenId}</p><h1>{screen.title}</h1><p>{description}</p></header>;
}

function Deferred({ children }: { children: ReactNode }) {
  return <section className="card"><h2>Owner-deferred</h2><p>{children}</p><p className="notice notice--warn">No account data or success state is fabricated while this owner is absent.</p></section>;
}

function resultError(result: { error: { message?: string } | null }): string | undefined {
  return result.error?.message ?? (result.error ? "The account request failed." : undefined);
}

function AuthorizedSessions({ currentToken }: { currentToken?: string }) {
  void currentToken;
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void fetch("/api/account/sessions/").then(async (response) => {
      const result = await response.json() as { error?: string; sessions?: AccountSession[] };
      if (!active) return;
      setLoading(false);
      if (!response.ok || !result.sessions) setError(result.error ?? "Authorized sessions could not be loaded.");
      else setSessions(result.sessions);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
      setError("Authorized sessions could not be loaded.");
    });
    return () => { active = false; };
  }, []);

  const revoke = async (sessionId: string) => {
    setBusy(true);
    const response = await fetch("/api/account/sessions/revoke-other", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) setError(result.error ?? "The other session could not be revoked.");
    else setSessions((current) => current.filter((session) => session.sessionId !== sessionId));
  };

  const revokeOthers = async () => {
    setBusy(true);
    const response = await fetch("/api/account/sessions/revoke-all-other", { method: "POST" });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) setError(result.error ?? "The other sessions could not be revoked.");
    else setSessions((current) => current.filter((session) => session.isCurrent));
  };

  const otherCount = sessions.filter((session) => !session.isCurrent).length;
  return <section className="card span-2"><div className="action-row action-row--between"><div><h2>Authorized sessions</h2><p>Current and other signed-in devices.</p></div><button className="button" disabled={busy || otherCount === 0} onClick={revokeOthers}>Revoke all other sessions</button></div>{loading ? <p className="notice">Loading sessions…</p> : sessions.length === 0 ? <p>No active sessions were returned.</p> : <div className="stack">{sessions.map((session) => <article className="card" key={session.sessionId}><div className="action-row action-row--between"><div><strong>{session.userAgent || "Unknown device"}</strong><p>{session.ipAddress || "IP unavailable"}</p><p>Last activity: {new Date(session.updatedAt).toLocaleString()}</p><p>Expires: {new Date(session.expiresAt).toLocaleString()}</p></div><div>{session.isCurrent ? <span className="tag">Current session</span> : <button className="button" disabled={busy} onClick={() => revoke(session.sessionId)}>Revoke this other session</button>}</div></div></article>)}</div>}{error && <p className="notice notice--bad" role="alert">{error}</p>}</section>;
}

function Profile({ currentSessionToken, screen, user }: { currentSessionToken?: string; screen: PageManifestEntry; user: AccountUser }) {
  const [displayName, setDisplayName] = useState(user.name);
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailStep, setEmailStep] = useState<"request" | "verify">(
    screen.screenId === "ACC003" ? "verify" : "request",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const modal = screen.screenId === "ACC002" || screen.screenId === "ACC003";

  const saveName = async () => {
    setBusy(true);
    setError(undefined);
    const result = await authClient.updateUser({ name: displayName });
    setBusy(false);
    const nextError = resultError(result);
    if (nextError) setError(nextError);
    else setMessage("Display name saved.");
  };

  const sendChangeEmailCode = async () => {
    setBusy(true);
    setError(undefined);
    const result = await authClient.emailOtp.sendVerificationOtp({
      email: newEmail,
      type: "change-email",
    });
    setBusy(false);
    const nextError = resultError(result);
    if (nextError) setError(nextError);
    else {
      setEmailStep("verify");
      setMessage("Verification code sent to the new email address.");
    }
  };

  const changeEmail = async () => {
    setBusy(true);
    setError(undefined);
    const result = await authClient.emailOtp.changeEmail({ newEmail, otp: code });
    setBusy(false);
    const nextError = resultError(result);
    if (nextError) setError(nextError);
    else setMessage("Email address changed.");
  };

  return <><AccountHead screen={screen} description={screen.screenId === "ACC004" ? "Current and other authorized account sessions." : "Account identity and profile details."} /><div className="split"><section className="card form-grid"><label className="field">Username<input className="input" value={user.displayUsername ?? user.username ?? ""} readOnly /></label><label className="field">Email<input className="input" value={user.email} readOnly /></label><label className="field span-2">Display name<input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><button className="button button--gold" disabled={busy || !displayName.trim()} onClick={saveName}>Save changes</button></section><aside className="card"><h2>Account</h2><p>Email changes require verification.</p><p>Username cannot be changed.</p><a className="button" href="/account/profile?state=ACC002">Change email</a>{screen.screenId !== "ACC004" && <><h3>Authorized sessions</h3><a href="/account/profile?state=ACC004">Manage sessions</a></>}</aside>{screen.screenId === "ACC004" && <AuthorizedSessions currentToken={currentSessionToken} />}</div>{error && <p className="notice notice--bad" role="alert">{error}</p>}{message && <p className="notice notice--good" role="status">{message}</p>}{modal && <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="change-email-title"><p className="kicker">CHANGE EMAIL</p><h2 id="change-email-title">{emailStep === "verify" ? "Verify the new email address." : "Change account email."}</h2>{emailStep === "verify" ? <><label className="field">New email<input className="input" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><label className="field">Verification code<OtpInput value={code} onChange={(event) => setCode(event.target.value)} /></label><p>The current account email is unchanged until verification succeeds.</p></> : <><label className="field">Current email<input className="input" type="email" value={user.email} readOnly /></label><label className="field">New email<input className="input" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label></>}<div className="action-row"><a className="button" href="/account/profile">Back</a>{emailStep === "verify" && <button className="button" disabled={busy || !newEmail} onClick={sendChangeEmailCode}>Resend</button>}<button className="button button--gold" disabled={busy || !newEmail || (emailStep === "verify" && code.length !== 6)} onClick={emailStep === "verify" ? changeEmail : sendChangeEmailCode}>{emailStep === "verify" ? "Verify & Change Email" : "Send Verification"}</button></div></section></div>}</>;
}

function Subscription({ screen }: { screen: PageManifestEntry }) {
  const [membership, setMembership] = useState<MembershipProjection>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void fetch("/api/account/membership").then(async (response) => {
      const result = await response.json() as MembershipProjection & { error?: string };
      if (!active) return;
      setLoading(false);
      if (!response.ok) setError(result.error ?? "Membership entitlement could not be loaded.");
      else setMembership(result);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
      setError("Membership entitlement could not be loaded.");
    });
    return () => { active = false; };
  }, []);

  const providerStateScreen = ["ACC006", "ACC007", "ACC009"].includes(screen.screenId);
  return <><AccountHead screen={screen} description="Subscription status, billing state and history." />{loading ? <p className="notice">Loading membership entitlement…</p> : error || !membership ? <p className="notice notice--bad" role="alert">{error ?? "Membership entitlement could not be loaded."}</p> : <div className="stack">{screen.screenId === "ACC005" && <section className="card"><h2>Monthly membership</h2><p><strong>{`$${(subscriptionPriceCents / 100).toFixed(2)} monthly`}</strong></p><p>A subscription will never be required.</p><button className="button button--gold" disabled>Start membership unavailable</button><p className="notice notice--warn">The displayed price is fixed by the server contract. No Stripe subscription operation is connected to this button.</p></section>}<section className="card"><h2>Membership entitlement</h2><dl className="detail-list"><dt>Status</dt><dd>{membership.active ? "Active" : "Inactive"}</dd><dt>Effective end</dt><dd>{membership.effectiveEndAt ? new Date(membership.effectiveEndAt).toLocaleString() : "No active entitlement"}</dd><dt>Voice window</dt><dd>{membership.voiceWindowSeconds} seconds</dd></dl><p className="muted">Membership benefits do not grant an authorization role or beta/player eligibility.</p></section>{screen.screenId === "ACC010" && <section className="card"><h2>Membership history</h2>{membership.grants.length === 0 ? <p>No membership grants.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>Source</th><th>Months</th><th>Effective start</th><th>Effective end</th></tr></thead><tbody>{membership.grants.map((grant) => <tr key={grant.membershipGrantId}><td>{grant.source}</td><td>{grant.monthsGranted}</td><td>{new Date(grant.effectiveStartAt).toLocaleString()}</td><td>{new Date(grant.effectiveEndAt).toLocaleString()}</td></tr>)}</tbody></table></div>}</section>}{membership.activePerks.length > 0 && <section className="card"><h2>Active perks</h2><ul>{membership.activePerks.map((perk) => <li key={perk.perkId}><strong>{perk.name}</strong>: {perk.description}</li>)}</ul></section>}{providerStateScreen && <Deferred>Stripe payment acceptance, decline, and cancellation actions require a persisted provider operation for this account. The membership ledger above is authoritative and no provider result is inferred from it.</Deferred>}</div>}</>;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function Orders({ pathname, screen }: { pathname?: string; screen: PageManifestEntry }) {
  const [orders, setOrders] = useState<AccountOrderProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const orderId = pathname?.match(/^\/account\/orders\/([^/]+)(?:\/return)?$/)?.[1];
  const detail = screen.screenId === "ACC012" || screen.screenId === "ACC013";

  useEffect(() => {
    let active = true;
    if (detail && !orderId) return () => { active = false; };
    const endpoint = detail ? `/api/account/orders/${encodeURIComponent(orderId!)}` : "/api/account/orders/";
    void fetch(endpoint).then(async (response) => {
      const result = await response.json() as { error?: string; order?: AccountOrderProjection; orders?: AccountOrderProjection[] };
      if (!active) return;
      setLoading(false);
      if (!response.ok) setError(result.error ?? "Orders could not be loaded.");
      else setOrders(result.order ? [result.order] : result.orders ?? []);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
      setError("Orders could not be loaded.");
    });
    return () => { active = false; };
  }, [detail, orderId]);

  const order = orders[0];
  let content;
  if (detail && !orderId) content = <p className="notice notice--bad" role="alert">Order identity is required.</p>;
  else if (loading) content = <p className="notice">Loading orders…</p>;
  else if (error) content = <p className="notice notice--bad" role="alert">{error}</p>;
  else if (!detail) content = orders.length === 0 ? <p>No merchandise orders.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>Order</th><th>Created</th><th>Items</th><th>Payment</th><th>Fulfillment</th></tr></thead><tbody>{orders.map((item) => <tr key={item.orderId}><td><a href={`/account/orders/${encodeURIComponent(item.orderId)}`}>{item.orderId}</a></td><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.lines.reduce((sum, line) => sum + line.quantity, 0)}</td><td>{item.payment ? `${money(item.payment.amountCents)} confirmed` : "No confirmed payment"}</td><td>{item.payment?.fulfillmentSubmittedAt ? "Submitted to Printful" : "Not submitted"}</td></tr>)}</tbody></table></div>;
  else if (!order) content = <p className="notice notice--bad" role="alert">Order not found.</p>;
  else if (screen.screenId === "ACC013") content = order.returnEligibleAt ? <section className="card"><h2>Return request</h2><p>Return eligibility was recorded at {new Date(order.returnEligibleAt).toLocaleString()}.</p><button className="button button--gold" disabled>Submit return unavailable</button><p className="notice notice--warn">No return-submission or refund workflow is inferred from eligibility alone.</p></section> : <section className="card"><h2>Return unavailable</h2><p>This order has no persisted return eligibility.</p><a className="button" href={`/account/orders/${encodeURIComponent(order.orderId)}`}>Back to order</a></section>;
  else content = <div className="stack"><section className="card"><h2>Order {order.orderId}</h2><dl className="detail-list"><dt>Created</dt><dd>{new Date(order.createdAt).toLocaleString()}</dd><dt>Payment</dt><dd>{order.payment ? `${money(order.payment.amountCents)} confirmed ${new Date(order.payment.confirmedAt).toLocaleString()}` : "No confirmed payment"}</dd><dt>Fulfillment</dt><dd>{order.payment?.fulfillmentSubmittedAt ? `Submitted ${new Date(order.payment.fulfillmentSubmittedAt).toLocaleString()}` : "Not submitted"}</dd><dt>Refunded</dt><dd>{money(order.refunds.reduce((sum, refund) => sum + refund.amountCents, 0))}</dd></dl>{order.returnEligibleAt && <a className="button" href={`/account/orders/${encodeURIComponent(order.orderId)}/return`}>Request a return</a>}</section><section className="card"><h2>Items</h2><div className="table-scroll"><table className="simple-table"><thead><tr><th>Product</th><th>Size</th><th>Color</th><th>Quantity</th><th>Unit price</th></tr></thead><tbody>{order.lines.map((line) => <tr key={line.orderLineId}><td>{line.name}</td><td>{line.size ?? "—"}</td><td>{line.color ?? "—"}</td><td>{line.quantity}</td><td>{money(line.unitPriceCents)}</td></tr>)}</tbody></table></div></section></div>;

  return <><AccountHead screen={screen} description="Merchandise orders and fulfillment status." />{content}<section className="card"><h2>Provider boundary</h2><p>Stripe payment and Printful fulfillment remain separate. Provider identifiers are not exposed.</p></section></>;
}

function Settings({ screen }: { screen: PageManifestEntry }) {
  return <><AccountHead screen={screen} description="One persisted settings owner shared by standalone, account, and game surfaces." /><SettingsPanel /></>;
}

function Progress({ screen }: { screen: PageManifestEntry }) {
  return <><AccountHead screen={screen} description="Current campaign progress and explicit challenge timing." /><Deferred>Campaign progress, Knowledge counts, and challenge countdowns require the player-runtime state owner, which is not supplied.</Deferred></>;
}

function Achievements({ screen }: { screen: PageManifestEntry }) {
  return <><AccountHead screen={screen} description="Unlocked and discoverable achievements." /><Deferred>Achievement definitions exist, but player award state, thresholds, and disclosure rules are not supplied.</Deferred></>;
}

function Support({ screen }: { screen: PageManifestEntry }) {
  const task = screen.screenId === "ACC020" ? "ticket creation" : screen.screenId === "ACC021" ? "ticket replies" : "ticket listing";
  return <><AccountHead screen={screen} description="Player support is separate from company contact." /><Deferred>Support recipient configuration exists, but {task} requires a ticket persistence, identity, status, and reply-delivery contract.</Deferred></>;
}

function Invitations({ screen }: { screen: PageManifestEntry }) {
  const [friendName, setFriendName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    const response = await fetch("/api/beta-invitations/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, friendName, reason }),
    });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) setError(result.error ?? "Invitation request could not be submitted.");
    else setSubmitted(true);
  };

  return <><AccountHead screen={screen} description="Request a beta invitation for another participant." />{submitted ? <section className="card"><h2>Invitation request received</h2><p>Thank you. The request was submitted successfully.</p><p>The request is not shown with an internal approval, rejection, queue, or pending status. If an invitation is issued, it is delivered through the invitation flow.</p><a className="button" href="/account">Back to Account</a></section> : <div className="grid-2"><section className="card form-grid"><h2 className="span-2">Request a friend invitation</h2><label className="field">Friend name<input className="input" value={friendName} onChange={(event) => setFriendName(event.target.value)} /></label><label className="field">Friend email<input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field span-2">Reason<textarea className="textarea" value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="button button--gold" disabled={busy || !friendName.trim() || !email.trim() || !reason.trim()} onClick={submit}>{busy ? "Submitting…" : "Submit request"}</button>{error && <p className="notice notice--bad span-2" role="alert">{error}</p>}</section><aside className="card"><h2>Beta is invite only</h2><p>A request is not an invitation. Administrative review is required, and approval sends the actual invitation by email.</p><p>Redemption grants beta/player eligibility only. It does not grant an authorization role or membership benefits.</p></aside></div>}</>;
}

function BetaLanding({ screen }: { screen: PageManifestEntry }) {
  const [access, setAccess] = useState<PlayerAccessProjection>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void fetch("/api/player/access").then(async (response) => {
      const result = await response.json() as PlayerAccessProjection & { error?: string };
      if (!active) return;
      if (!response.ok) setError(result.error ?? "Player access could not be verified.");
      else setAccess(result);
    }).catch(() => {
      if (active) setError("Player access could not be verified.");
    });
    return () => { active = false; };
  }, []);

  return <><AccountHead screen={screen} description="Authenticated account landing." />{error ? <p className="notice notice--bad" role="alert">{error}</p> : !access ? <p className="notice">Checking player access…</p> : <div className="grid-2"><section className="card"><h2>Account access</h2><dl className="detail-list"><dt>Authorization role</dt><dd>{access.role.toUpperCase()}</dd><dt>Beta/player eligible</dt><dd>{access.betaEligible ? "Yes" : "No"}</dd><dt>Membership entitlement</dt><dd>{access.membershipEntitled ? "Active" : "Inactive"}</dd><dt>Voice window</dt><dd>{access.voiceWindowSeconds} seconds</dd></dl><a className="button" href="/account/profile">View profile</a></section><section className="card"><h2>{access.canPlay ? "Beta access verified" : "Player eligibility required"}</h2><p>{access.canPlay ? "This account may enter the authenticated player shell." : "Authorization role and membership entitlement do not grant beta/player eligibility."}</p>{access.canPlay && <a className="button button--gold" href="/game">Enter Game</a>}</section></div>}</>;
}

function SignedInAccountPage({ currentSessionToken, pathname, screen, user }: { currentSessionToken?: string; pathname?: string; screen: PageManifestEntry; user: AccountUser }) {
  if (screen.screenId === "ACC030") return <BetaLanding screen={screen} />;
  if (["ACC001", "ACC002", "ACC003", "ACC004"].includes(screen.screenId)) return <Profile currentSessionToken={currentSessionToken} screen={screen} user={user} />;
  if (screen.screenId >= "ACC005" && screen.screenId <= "ACC010") return <Subscription screen={screen} />;
  if (["ACC011", "ACC012", "ACC013"].includes(screen.screenId)) return <Orders pathname={pathname} screen={screen} />;
  if (["ACC014", "ACC015"].includes(screen.screenId)) return <Settings screen={screen} />;
  if (["ACC016", "ACC017"].includes(screen.screenId)) return <Progress screen={screen} />;
  if (screen.screenId === "ACC018") return <Achievements screen={screen} />;
  if (["ACC019", "ACC020", "ACC021"].includes(screen.screenId)) return <Support screen={screen} />;
  if (["ACC022", "ACC023"].includes(screen.screenId)) return <Invitations screen={screen} />;
  return <><AccountHead screen={screen} description="This account screen is not registered." /><section className="card"><h2>Account screen unavailable</h2><p>No account workflow is inferred for an unknown screen.</p></section></>;
}

export function AccountPage({ pathname, screen }: { pathname?: string; screen: PageManifestEntry }) {
  const session = authClient.useSession();
  let page;
  if (session.isPending) {
    page = <><AccountHead screen={screen} description="Checking account session." /><p className="notice">Checking account session…</p></>;
  } else if (!session.data) {
    page = <><AccountHead screen={screen} description="A signed-in account is required." /><section className="card"><h2>Sign in required</h2><p>No account, order, progress, or support data is shown without an authenticated session.</p><a className="button button--gold" href="/auth/sign-in">Sign In</a></section></>;
  } else {
    page = <SignedInAccountPage currentSessionToken={session.data.session?.token} pathname={pathname} screen={screen} user={session.data.user} />;
  }
  return <AccountShell>{page}</AccountShell>;
}
