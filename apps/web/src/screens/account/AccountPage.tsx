import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";

import { AccountShell } from "../../components/shells/Shells";
import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import { SettingsPanel } from "../../components/SettingsPanel";
import { OtpInput, PasswordInput } from "../../components/ui/controls";
import { inviteConsent } from "../../content/public";
import { subscriptionPriceCents } from "../../domain/membership";
import { passwordsMatch, preserveResetIdentity } from "../../domain/password-workflows";
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
  subscription: null | {
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    currentPeriodEndAt: string | null;
    currentPeriodStartAt: string | null;
    events: Array<{ eventType: string; occurredAt: string; providerStatus: string }>;
    providerStatus: string;
    stripeCustomerReference: string | null;
  };
  voiceWindowSeconds: number;
}

interface PlayerAccessProjection {
  betaEligible: boolean;
  canPlay: boolean;
  membershipEntitled: boolean;
  participationEligible: boolean;
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

interface HelpTicketProjection {
  categoryKey: string;
  channel: string;
  createdAt: string;
  helpTicketId: string;
  messages: Array<{
    attachments: Array<{ byteSize: number; fileName: string; helpTicketAttachmentId: string; mimeType: string }>;
    authorKind: string;
    createdAt: string;
    helpTicketMessageId: string;
    message: string;
  }>;
  orderId: string | null;
  status: "OPEN" | "RESOLVED";
  subject: string;
  updatedAt: string;
}

async function encodedAttachment(file: File | null) {
  if (!file) return [];
  if (file.size > 5 * 1024 * 1024) throw new Error("Attachment must not exceed 5 MiB.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Attachment could not be read."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  return [{ base64: dataUrl.split(",")[1] ?? "", fileName: file.name, mimeType: file.type }];
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

function AccountValue({ label, value }: { label: string; value: string }) {
  const labelId = useId();
  return <div aria-labelledby={labelId} className="account-value" role="group"><span className="account-value__label" id={labelId}>{label}</span><span className="account-value__text">{value}</span></div>;
}

function ChangePassword({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string>();

  const changePassword = async () => {
    if (!passwordsMatch(newPassword, confirmation) || !currentPassword) return;
    setBusy(true); setError(undefined);
    const result = await authClient.changePassword({ currentPassword, newPassword });
    setBusy(false);
    const nextError = resultError(result);
    if (nextError) setError(nextError);
    else setCompleted(true);
  };

  const recover = async () => {
    setBusy(true); setError(undefined);
    const result = await authClient.emailOtp.requestPasswordReset({ email });
    setBusy(false);
    const nextError = resultError(result);
    if (nextError) setError(nextError);
    else {
      preserveResetIdentity(email);
      window.location.assign("/auth/reset-password");
    }
  };

  return <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="change-password-title"><p className="kicker">ACCOUNT SECURITY</p>{completed ? <><h2 id="change-password-title">Password Changed</h2><p>Your password has been changed successfully.</p><a className="button button--gold" href="/account/profile">Return to Account</a></> : <><h2 id="change-password-title">Change Password</h2><p>Confirm your current password, then choose a new password.</p><form className="stack" onSubmit={(event) => { event.preventDefault(); void changePassword(); }}><PasswordInput autoComplete="current-password" label="Current password" onChange={(event) => setCurrentPassword(event.target.value)} value={currentPassword} /><PasswordInput autoComplete="new-password" label="New password" onChange={(event) => setNewPassword(event.target.value)} value={newPassword} /><PasswordInput autoComplete="new-password" label="Confirm new password" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /><div className="action-row"><a className="button" href="/account/profile">Back</a><button className="button button--gold" disabled={busy || !currentPassword || !passwordsMatch(newPassword, confirmation)} type="submit">{busy ? "Working…" : "Change Password"}</button></div><button className="button" disabled={busy} onClick={() => void recover()} type="button">Forgot your current password?</button></form></>}{error && <p className="notice notice--bad" role="alert">{error}</p>}</section></div>;
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
  const passwordModal = screen.screenId === "ACC024";

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
    const result = await authClient.emailOtp.requestEmailChange({ newEmail });
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

  return <><AccountHead screen={screen} description={screen.screenId === "ACC004" ? "Current and other authorized account sessions." : "Account identity and profile details."} /><div className="split"><section className="card form-grid"><AccountValue label="Username" value={user.displayUsername ?? user.username ?? ""} /><AccountValue label="Email" value={user.email} /><label className="field span-2">Display name<input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><button className="button button--gold" disabled={busy || !displayName.trim()} onClick={saveName}>Save changes</button></section><aside className="card"><h2>Account</h2><p>Email changes require verification.</p><p>Username cannot be changed.</p><div className="action-row"><a className="button" href="/account/profile?state=ACC002">Change email</a><a className="button" href="/account/profile?state=ACC024">Change password</a></div>{screen.screenId !== "ACC004" && <><h3>Authorized sessions</h3><a href="/account/profile?state=ACC004">Manage sessions</a></>}</aside>{screen.screenId === "ACC004" && <AuthorizedSessions currentToken={currentSessionToken} />}</div>{error && <p className="notice notice--bad" role="alert">{error}</p>}{message && <p className="notice notice--good" role="status">{message}</p>}{modal && <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="change-email-title"><p className="kicker">CHANGE EMAIL</p><h2 id="change-email-title">{emailStep === "verify" ? "Verify the new email address." : "Change account email."}</h2>{emailStep === "verify" ? <><label className="field">New email<input className="input" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><label className="field">Verification code<OtpInput value={code} onChange={(event) => setCode(event.target.value)} /></label><p>The current account email is unchanged until verification succeeds.</p></> : <><AccountValue label="Current email" value={user.email} /><label className="field">New email<input className="input" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label></>}<div className="action-row"><a className="button" href="/account/profile">Back</a>{emailStep === "verify" && <button className="button" disabled={busy || !newEmail} onClick={sendChangeEmailCode}>Resend</button>}<button className="button button--gold" disabled={busy || !newEmail || (emailStep === "verify" && code.length !== 6)} onClick={emailStep === "verify" ? changeEmail : sendChangeEmailCode}>{emailStep === "verify" ? "Verify & Change Email" : "Send Verification"}</button></div></section></div>}{passwordModal && <ChangePassword email={user.email} />}</>;
}

function Subscription({ screen }: { screen: PageManifestEntry }) {
  const [membership, setMembership] = useState<MembershipProjection>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

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

  const post = async (endpoint: string) => {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    const response = await fetch(endpoint, { method: "POST" });
    const result = await response.json() as { checkoutUrl?: string; error?: string; portalUrl?: string; subscription?: MembershipProjection["subscription"] };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "The Stripe subscription operation failed.");
    if (result.checkoutUrl || result.portalUrl) return window.location.assign(result.checkoutUrl ?? result.portalUrl!);
    if (result.subscription) setMembership((current) => current ? { ...current, subscription: result.subscription! } : current);
    setMessage("Subscription renewal cancellation is recorded. Existing Member time remains available through its current boundary.");
  };

  const subscription = membership?.subscription;
  const providerStatus = subscription?.providerStatus ?? "NOT_SUBSCRIBED";
  type Grant = MembershipProjection["grants"][number];
  type SubscriptionEvent = NonNullable<MembershipProjection["subscription"]>["events"][number];
  const grantColumns: DataTableColumnDef<Grant>[] = [
    { accessorKey: "source", header: "Source" },
    { accessorKey: "membershipGrantId", header: "Grant ID" },
    { accessorKey: "monthsGranted", header: "Months" },
    { accessorKey: "effectiveStartAt", header: "Effective start", cell: ({ row }) => new Date(row.original.effectiveStartAt).toLocaleString() },
    { accessorKey: "effectiveEndAt", header: "Effective end", cell: ({ row }) => new Date(row.original.effectiveEndAt).toLocaleString() },
  ];
  const eventColumns: DataTableColumnDef<SubscriptionEvent>[] = [
    { accessorKey: "eventType", header: "Event" },
    { accessorKey: "providerStatus", header: "Status" },
    { accessorKey: "occurredAt", header: "Occurred", cell: ({ row }) => new Date(row.original.occurredAt).toLocaleString() },
  ];
  return <><AccountHead screen={screen} description="Subscription status, billing state and history." />{loading ? <p className="notice">Loading membership entitlement…</p> : error || !membership ? <p className="notice notice--bad" role="alert">{error ?? "Membership entitlement could not be loaded."}</p> : <div className="stack">
    {screen.screenId === "ACC005" && <section className="card"><h2>Monthly membership</h2><p><strong>{`$${(subscriptionPriceCents / 100).toFixed(2)} per calendar month`}</strong></p><p>A subscription will never be required.</p><button className="button button--gold" disabled={busy} onClick={() => void post("/api/account/subscription/checkout")}>{busy ? "Opening Stripe…" : "Subscribe with Stripe"}</button><p className="muted">Member is an entitlement. It never changes your account, admin, invitation, or participation authorization.</p></section>}
    {screen.screenId === "ACC006" && <section className="card"><h2>Payment accepted</h2><p className={`notice ${providerStatus === "ACTIVE" ? "notice--good" : "notice--warn"}`}>{providerStatus === "ACTIVE" ? "Stripe payment and the persisted subscription event are confirmed." : "Stripe returned successfully; waiting for the signed webhook before granting Member time."}</p></section>}
    {screen.screenId === "ACC007" && <section className="card"><h2>Payment not completed</h2><p>No Member entitlement was granted by this declined/canceled browser state.</p><a className="button button--gold" href="/account/subscription?state=ACC005">Try again</a></section>}
    {screen.screenId === "ACC009" && <section className="card"><h2>Cancel renewal</h2><p>Cancellation stops renewal. Already-earned access remains through its existing exclusive Member-through boundary.</p><button className="button button--gold" disabled={busy || !subscription || subscription.cancelAtPeriodEnd} onClick={() => void post("/api/account/subscription/cancel")}>{subscription?.cancelAtPeriodEnd ? "Renewal already canceled" : busy ? "Canceling…" : "Confirm cancellation"}</button></section>}
    <section className="card"><h2>Membership entitlement</h2><dl className="detail-list"><dt>Provider state</dt><dd>{providerStatus}</dd><dt>Entitlement</dt><dd>{membership.active ? "Active" : "Inactive"}</dd><dt>Member through (exclusive)</dt><dd>{membership.effectiveEndAt ? new Date(membership.effectiveEndAt).toLocaleString() : "No active entitlement"}</dd><dt>Renewal</dt><dd>{subscription?.cancelAtPeriodEnd ? "Canceled at period end" : subscription ? "Enabled" : "Not subscribed"}</dd></dl><div className="action-row">{subscription?.stripeCustomerReference !== null && subscription && <button className="button" disabled={busy} onClick={() => void post("/api/account/subscription/portal")}>Manage payment method</button>}{screen.screenId === "ACC008" && subscription && !subscription.cancelAtPeriodEnd && <a className="button" href="/account/subscription?state=ACC009">Cancel renewal</a>}</div><p className="muted">Membership benefits do not grant an authorization role or beta/player eligibility.</p></section>
    {screen.screenId === "ACC010" && <><section className="card"><h2>Membership grant history</h2><DataTable columns={grantColumns} data={membership.grants} getRowId={(grant) => grant.membershipGrantId} preferenceKey="account.membership-grants" /></section><section className="card"><h2>Subscription event history</h2><DataTable columns={eventColumns} data={subscription?.events ?? []} getRowId={(event) => `${event.eventType}:${event.occurredAt}`} preferenceKey="account.subscription-events" /></section></>}
    {membership.activePerks.length > 0 && <section className="card"><h2>Active perks</h2><ul>{membership.activePerks.map((perk) => <li key={perk.perkId}><strong>{perk.name}</strong>: {perk.description}</li>)}</ul></section>}
    {message && <p className="notice notice--good" role="status">{message}</p>}
  </div>}</>;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ReturnRequestForm({ order }: { order: AccountOrderProjection }) {
  const [subject, setSubject] = useState(`Return request for ${order.orderId}`);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const attachments = await encodedAttachment(attachment);
      const response = await fetch(`/api/account/orders/${encodeURIComponent(order.orderId)}/return`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attachments, message, subject }) });
      const body = await response.json() as { error?: string; ticket?: HelpTicketProjection };
      if (!response.ok || !body.ticket) setError(body.error ?? "Return request could not be submitted.");
      else setResult(`Return request ${body.ticket.helpTicketId} submitted for review. No refund or fulfillment change has been made.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Return request could not be submitted."); }
    setBusy(false);
  };
  if (result) return <section className="card"><h2>Return request received</h2><p className="notice notice--good" role="status">{result}</p><a className="button" href={`/account/orders/${encodeURIComponent(order.orderId)}`}>Back to order</a></section>;
  return <section className="card form-grid"><h2 className="span-2">Return request</h2><p className="span-2">Return eligibility was recorded at {new Date(order.returnEligibleAt!).toLocaleString()}. Submission opens a review request; it does not issue a refund or cancel Printful fulfillment.</p><label className="field span-2">Subject<input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label className="field span-2">Reason and requested resolution<textarea className="textarea" value={message} onChange={(event) => setMessage(event.target.value)} /></label><label className="field span-2">Attachment<input accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" type="file" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} /></label><button className="button button--gold" disabled={busy || !subject.trim() || !message.trim()} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit return request"}</button>{error && <p className="notice notice--bad span-2" role="alert">{error}</p>}</section>;
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
  const orderColumns: DataTableColumnDef<AccountOrderProjection>[] = [
    { accessorKey: "orderId", header: "Order ID", cell: ({ row }) => <a href={`/account/orders/${encodeURIComponent(row.original.orderId)}`}>{row.original.orderId}</a> },
    { accessorKey: "createdAt", header: "Created", cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
    { accessorFn: (item) => item.lines.reduce((sum, line) => sum + line.quantity, 0), header: "Items", id: "itemCount" },
    { accessorFn: (item) => item.payment ? `${money(item.payment.amountCents)} confirmed` : "No confirmed payment", header: "Payment", id: "paymentLabel" },
    { accessorFn: (item) => item.payment?.fulfillmentSubmittedAt ? "Submitted to Printful" : "Not submitted", header: "Fulfillment", id: "fulfillment" },
    { accessorFn: (item) => JSON.stringify(item.lines), header: "Order lines", id: "lines" },
    { accessorFn: (item) => JSON.stringify(item.payment), header: "Payment record", id: "payment" },
    { accessorFn: (item) => JSON.stringify(item.refunds), header: "Refunds", id: "refunds" },
    { accessorKey: "returnEligibleAt", header: "Return eligible" },
  ];
  type AccountOrderLine = AccountOrderProjection["lines"][number];
  const lineColumns: DataTableColumnDef<AccountOrderLine>[] = [
    { accessorKey: "name", header: "Product" },
    { accessorKey: "orderLineId", header: "Order line ID" },
    { accessorKey: "storeVariantId", header: "Variant ID" },
    { accessorKey: "size", header: "Size" },
    { accessorKey: "color", header: "Color" },
    { accessorKey: "quantity", header: "Quantity" },
    { accessorKey: "unitPriceCents", header: "Unit price", cell: ({ row }) => money(row.original.unitPriceCents) },
  ];
  let content;
  if (detail && !orderId) content = <p className="notice notice--bad" role="alert">Order identity is required.</p>;
  else if (loading) content = <p className="notice">Loading orders…</p>;
  else if (error) content = <p className="notice notice--bad" role="alert">{error}</p>;
  else if (!detail) content = <DataTable columns={orderColumns} data={orders} getRowId={(item) => item.orderId} preferenceKey="account.orders" />;
  else if (!order) content = <p className="notice notice--bad" role="alert">Order not found.</p>;
  else if (screen.screenId === "ACC013") content = order.returnEligibleAt ? <ReturnRequestForm order={order} /> : <section className="card"><h2>Return unavailable</h2><p>This order has no persisted return eligibility.</p><a className="button" href={`/account/orders/${encodeURIComponent(order.orderId)}`}>Back to order</a></section>;
  else content = <div className="stack"><section className="card"><h2>Order {order.orderId}</h2><dl className="detail-list"><dt>Created</dt><dd>{new Date(order.createdAt).toLocaleString()}</dd><dt>Payment</dt><dd>{order.payment ? `${money(order.payment.amountCents)} confirmed ${new Date(order.payment.confirmedAt).toLocaleString()}` : "No confirmed payment"}</dd><dt>Fulfillment</dt><dd>{order.payment?.fulfillmentSubmittedAt ? `Submitted ${new Date(order.payment.fulfillmentSubmittedAt).toLocaleString()}` : "Not submitted"}</dd><dt>Refunded</dt><dd>{money(order.refunds.reduce((sum, refund) => sum + refund.amountCents, 0))}</dd></dl>{order.returnEligibleAt && <a className="button" href={`/account/orders/${encodeURIComponent(order.orderId)}/return`}>Request a return</a>}</section><section className="card"><h2>Items</h2><DataTable columns={lineColumns} data={order.lines} getRowId={(line) => line.orderLineId} preferenceKey="account.order-lines" /></section></div>;

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

function Support({ pathname, screen }: { pathname?: string; screen: PageManifestEntry }) {
  const ticketId = pathname?.match(/^\/account\/support\/([^/]+)$/)?.[1];
  const [tickets, setTickets] = useState<HelpTicketProjection[]>([]);
  const [categoryKey, setCategoryKey] = useState("ACCOUNT_ACCESS");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loading, setLoading] = useState(screen.screenId !== "ACC020");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmation, setConfirmation] = useState<string>();

  useEffect(() => {
    if (screen.screenId === "ACC020") return;
    let active = true;
    const endpoint = ticketId ? `/api/account/support/${encodeURIComponent(ticketId)}` : "/api/account/support/";
    void fetch(endpoint).then(async (response) => {
      const result = await response.json() as { error?: string; ticket?: HelpTicketProjection; tickets?: HelpTicketProjection[] };
      if (!active) return;
      setLoading(false);
      if (!response.ok) setError(result.error ?? "Help Tickets could not be loaded.");
      else setTickets(result.ticket ? [result.ticket] : result.tickets ?? []);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
      setError("Help Tickets could not be loaded.");
    });
    return () => { active = false; };
  }, [screen.screenId, ticketId]);

  const submit = async (reply: boolean) => {
    setBusy(true); setError(undefined); setConfirmation(undefined);
    try {
      const attachments = await encodedAttachment(attachment);
      const response = await fetch(reply ? `/api/account/support/${encodeURIComponent(ticketId!)}` : "/api/account/support/", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(reply ? { attachments, message } : { attachments, categoryKey, message, subject }),
      });
      const result = await response.json() as { error?: string; ticket?: HelpTicketProjection };
      if (!response.ok || !result.ticket) setError(result.error ?? "Help Ticket could not be submitted.");
      else { setTickets([result.ticket]); setMessage(""); setAttachment(null); setConfirmation(reply ? "Reply added." : `Help Ticket ${result.ticket.helpTicketId} created.`); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Attachment could not be submitted."); }
    setBusy(false);
  };

  const ticket = tickets[0];
  let content;
  if (screen.screenId === "ACC020") content = <section className="card form-grid"><h2 className="span-2">Create Help Ticket</h2><label className="field">Category<select className="select" value={categoryKey} onChange={(event) => setCategoryKey(event.target.value)}><option value="ACCOUNT_ACCESS">Account access</option><option value="GAMEPLAY">Gameplay</option><option value="TECHNICAL">Technical</option><option value="OTHER">Other player support</option></select></label><label className="field">Subject<input className="input" maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label className="field span-2">Message<textarea className="textarea" maxLength={10_000} value={message} onChange={(event) => setMessage(event.target.value)} /></label><label className="field span-2">Attachment (optional, up to 5 MiB)<input accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" type="file" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} /></label><button className="button button--gold" disabled={busy || !subject.trim() || !message.trim()} onClick={() => void submit(false)}>{busy ? "Submitting…" : "Create Help Ticket"}</button></section>;
  else if (loading) content = <p className="notice">Loading Help Tickets…</p>;
  else if (screen.screenId === "ACC021") content = !ticket ? <p className="notice notice--bad">Help Ticket not found or permission denied.</p> : <div className="stack"><section className="card"><div className="action-row action-row--between"><div><p className="kicker">{ticket.categoryKey}</p><h2>{ticket.subject}</h2></div><span className="tag">{ticket.status}</span></div>{ticket.orderId && <p>Order: {ticket.orderId}</p>}</section><section className="card"><h2>Thread</h2>{ticket.messages.map((entry) => <article className="card" key={entry.helpTicketMessageId}><p className="kicker">{entry.authorKind} · {new Date(entry.createdAt).toLocaleString()}</p><p>{entry.message}</p>{entry.attachments.length > 0 && <ul>{entry.attachments.map((file) => <li key={file.helpTicketAttachmentId}>{file.fileName} · {file.mimeType} · {file.byteSize} bytes</li>)}</ul>}</article>)}</section><section className="card form-grid"><h2 className="span-2">Reply</h2><label className="field span-2">Message<textarea className="textarea" value={message} onChange={(event) => setMessage(event.target.value)} /></label><label className="field span-2">Attachment<input accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" type="file" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} /></label><button className="button button--gold" disabled={busy || ticket.status !== "OPEN" || !message.trim()} onClick={() => void submit(true)}>Add Reply</button></section></div>;
  else content = <div className="stack"><nav className="tabs" aria-label="Help Ticket views"><a href="/account/support#open">Open</a><a href="/account/support#resolved">Resolved</a><a href="/account/support/new">Create</a></nav>{tickets.length === 0 ? <section className="card"><h2>No Help Tickets</h2><p>Create a Help Ticket for account, gameplay, or technical support.</p><a className="button button--gold" href="/account/support/new">Create Help Ticket</a></section> : <><section className="card"><h2>Open</h2>{tickets.filter((item) => item.status === "OPEN").map((item) => <p key={item.helpTicketId}><a href={`/account/support/${encodeURIComponent(item.helpTicketId)}`}>{item.subject}</a> · {new Date(item.updatedAt).toLocaleString()}</p>)}</section><section className="card"><h2>Resolved</h2>{tickets.filter((item) => item.status === "RESOLVED").map((item) => <p key={item.helpTicketId}><a href={`/account/support/${encodeURIComponent(item.helpTicketId)}`}>{item.subject}</a> · {new Date(item.updatedAt).toLocaleString()}</p>)}</section></>}</div>;
  return <><AccountHead screen={screen} description="Player/account/gameplay support is separate from company contact and Store order support." />{content}{error && <p className="notice notice--bad" role="alert">{error}</p>}{confirmation && <p className="notice notice--good" role="status">{confirmation}</p>}</>;
}

function Invitations({ screen }: { screen: PageManifestEntry }) {
  const [friendName, setFriendName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (!consent) return;
    setBusy(true);
    setError(undefined);
    const response = await fetch("/api/beta-invitations/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ consent: true, email, friendName, reason }),
    });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) setError(result.error ?? "Invitation request could not be submitted.");
    else setSubmitted(true);
  };

  return <><AccountHead screen={screen} description="Request a beta invitation for another participant." />{submitted ? <section className="card"><h2>Invitation request received</h2><p>Thank you. The request was submitted successfully.</p><p>The request is not shown with an internal approval, rejection, queue, or pending status. If an invitation is issued, it is delivered through the invitation flow.</p><a className="button" href="/account">Back to Account</a></section> : <div className="grid-2"><section className="card form-grid"><h2 className="span-2">Request a friend invitation</h2><label className="field">Friend name<input className="input" value={friendName} onChange={(event) => setFriendName(event.target.value)} /></label><label className="field">Friend email<input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field span-2">Reason<textarea className="textarea" value={reason} onChange={(event) => setReason(event.target.value)} /></label><label className="check span-2"><input checked={consent} type="checkbox" onChange={(event) => setConsent(event.target.checked)} /> {inviteConsent}</label><button className="button button--gold" disabled={busy || !consent || !friendName.trim() || !email.trim() || !reason.trim()} onClick={submit}>{busy ? "Submitting…" : "Submit request"}</button>{error && <p className="notice notice--bad span-2" role="alert">{error}</p>}</section><aside className="card"><h2>Beta is invite only</h2><p>A request is not an invitation. Administrative review is required, and approval sends the actual invitation by email.</p><p>Redemption grants beta/player eligibility only. It does not grant an authorization role or membership benefits.</p></aside></div>}</>;
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
  if (["ACC001", "ACC002", "ACC003", "ACC004", "ACC024"].includes(screen.screenId)) return <Profile currentSessionToken={currentSessionToken} screen={screen} user={user} />;
  if (screen.screenId >= "ACC005" && screen.screenId <= "ACC010") return <Subscription screen={screen} />;
  if (["ACC011", "ACC012", "ACC013"].includes(screen.screenId)) return <Orders pathname={pathname} screen={screen} />;
  if (["ACC014", "ACC015"].includes(screen.screenId)) return <Settings screen={screen} />;
  if (["ACC016", "ACC017"].includes(screen.screenId)) return <Progress screen={screen} />;
  if (screen.screenId === "ACC018") return <Achievements screen={screen} />;
  if (["ACC019", "ACC020", "ACC021"].includes(screen.screenId)) return <Support pathname={pathname} screen={screen} />;
  if (["ACC022", "ACC023"].includes(screen.screenId)) return <Invitations screen={screen} />;
  return <><AccountHead screen={screen} description="This account screen is not registered." /><section className="card"><h2>Account screen unavailable</h2><p>No account workflow is inferred for an unknown screen.</p></section></>;
}

export function AccountPage({ pathname, screen }: { pathname?: string; screen: PageManifestEntry }) {
  const session = authClient.useSession();
  const returnTo = pathname ?? (screen.path?.startsWith("/") ? screen.path : "/account");
  let page;
  if (session.isPending) {
    page = <><AccountHead screen={screen} description="Checking account session." /><p className="notice">Checking account session…</p></>;
  } else if (!session.data) {
    page = <><AccountHead screen={screen} description="A signed-in account is required." /><section className="card"><h2>Sign in required</h2><p>No account, order, progress, or support data is shown without an authenticated session.</p><a className="button button--gold" href={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>Sign In</a></section></>;
  } else {
    page = <SignedInAccountPage currentSessionToken={session.data.session?.token} pathname={pathname} screen={screen} user={session.data.user} />;
  }
  return <AccountShell>{page}</AccountShell>;
}
