import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AccountShell } from "../../components/shells/Shells";
import { OtpInput } from "../../components/ui/controls";
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
  token: string;
  updatedAt: Date | string;
  userAgent?: string | null;
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
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void authClient.listSessions().then((result) => {
      if (!active) return;
      setLoading(false);
      const nextError = resultError(result);
      if (nextError) setError(nextError);
      else setSessions(result.data ?? []);
    });
    return () => { active = false; };
  }, []);

  const revoke = async (token: string) => {
    if (token === currentToken) {
      setError("The current session cannot be revoked by an other-session action.");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/account/sessions/revoke-other", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) setError(result.error ?? "The other session could not be revoked.");
    else setSessions((current) => current.filter((session) => session.token !== token));
  };

  const revokeOthers = async () => {
    setBusy(true);
    const response = await fetch("/api/account/sessions/revoke-all-other", { method: "POST" });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) setError(result.error ?? "The other sessions could not be revoked.");
    else setSessions((current) => current.filter((session) => session.token === currentToken));
  };

  const otherCount = sessions.filter((session) => session.token !== currentToken).length;
  return <section className="card span-2"><div className="action-row action-row--between"><div><h2>Authorized sessions</h2><p>Current and other signed-in devices.</p></div><button className="button" disabled={busy || otherCount === 0} onClick={revokeOthers}>Revoke all other sessions</button></div>{loading ? <p className="notice">Loading sessions…</p> : sessions.length === 0 ? <p>No active sessions were returned.</p> : <div className="stack">{sessions.map((session) => { const current = session.token === currentToken; return <article className="card" key={session.token}><div className="action-row action-row--between"><div><strong>{session.userAgent || "Unknown device"}</strong><p>{session.ipAddress || "IP unavailable"}</p><p>Last activity: {new Date(session.updatedAt).toLocaleString()}</p><p>Expires: {new Date(session.expiresAt).toLocaleString()}</p></div><div>{current ? <span className="tag">Current session</span> : <button className="button" disabled={busy} onClick={() => revoke(session.token)}>Revoke this other session</button>}</div></div></article>; })}</div>}{error && <p className="notice notice--bad" role="alert">{error}</p>}</section>;
}

function Profile({ currentSessionToken, screen, user }: { currentSessionToken?: string; screen: PageManifestEntry; user: AccountUser }) {
  const [displayName, setDisplayName] = useState(user.name);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
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
    const signIn = await authClient.signIn.email({ email: user.email, password });
    const signInError = resultError(signIn);
    if (signInError) {
      setBusy(false);
      setError(signInError);
      return;
    }
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

  return <><AccountHead screen={screen} description={screen.screenId === "ACC004" ? "Current and other authorized account sessions." : "Account identity and profile details."} /><div className="split"><section className="card form-grid"><label className="field">Username<input className="input" value={user.displayUsername ?? user.username ?? ""} readOnly /></label><label className="field">Email<input className="input" value={user.email} readOnly /></label><label className="field span-2">Display name<input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><button className="button button--gold" disabled={busy || !displayName.trim()} onClick={saveName}>Save changes</button></section><aside className="card"><h2>Account</h2><p>Email changes require verification.</p><p>Username cannot be changed.</p><a className="button" href="/account/profile?state=ACC002">Change email</a>{screen.screenId !== "ACC004" && <><h3>Authorized sessions</h3><a href="/account/profile?state=ACC004">Manage sessions</a></>}</aside>{screen.screenId === "ACC004" && <AuthorizedSessions currentToken={currentSessionToken} />}</div>{error && <p className="notice notice--bad" role="alert">{error}</p>}{message && <p className="notice notice--good" role="status">{message}</p>}{modal && <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="change-email-title"><p className="kicker">CHANGE EMAIL</p><h2 id="change-email-title">{emailStep === "verify" ? "Verify the new email address." : "Change account email."}</h2>{emailStep === "verify" ? <><label className="field">New email<input className="input" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><label className="field">Verification code<OtpInput value={code} onChange={(event) => setCode(event.target.value)} /></label><p>The current account email is unchanged until verification succeeds.</p></> : <><label className="field">New email<input className="input" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><label className="field">Current password<input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label></>}<div className="action-row"><a className="button" href="/account/profile">Back</a>{emailStep === "verify" && <button className="button" disabled={busy || !newEmail} onClick={sendChangeEmailCode}>Resend</button>}<button className="button button--gold" disabled={busy || !newEmail || (emailStep === "request" ? !password : code.length !== 6)} onClick={emailStep === "verify" ? changeEmail : sendChangeEmailCode}>{emailStep === "verify" ? "Verify & Change Email" : "Send Verification"}</button></div></section></div>}</>;
}

function Subscription({ screen }: { screen: PageManifestEntry }) {
  return <><AccountHead screen={screen} description="Subscription status, billing state and history." /><Deferred>The packet establishes Stripe as the payment owner, but it supplies no subscription product, price, entitlement, or persisted subscription contract.</Deferred></>;
}

function Orders({ screen }: { screen: PageManifestEntry }) {
  return <><AccountHead screen={screen} description="Merchandise orders and fulfillment status." /><div className="grid-2"><Deferred>No Order persistence or authenticated order-query contract is supplied.</Deferred><section className="card"><h2>Provider boundary</h2><p>Stripe payment and Printful fulfillment remain separate. No order or fulfillment state is inferred from provider configuration.</p></section></div></>;
}

function Settings({ screen }: { screen: PageManifestEntry }) {
  return <><AccountHead screen={screen} description="Accessibility, communication and account preferences." /><Deferred>The reviewed settings fields have no supplied persistence owner. They remain unavailable instead of being stored in an invented browser or database schema.</Deferred></>;
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
  const [submitted, setSubmitted] = useState(screen.screenId === "ACC023");
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
  return <><AccountHead screen={screen} description="Authenticated account landing." /><div className="grid-2"><section className="card"><h2>Account access</h2><p>The Better Auth session is active.</p><a className="button" href="/account/profile">View profile</a></section><Deferred>Beta participation and MEMBER/USER access require an account-access owner and role model.</Deferred></div></>;
}

function SignedInAccountPage({ currentSessionToken, screen, user }: { currentSessionToken?: string; screen: PageManifestEntry; user: AccountUser }) {
  if (screen.screenId === "ACC030") return <BetaLanding screen={screen} />;
  if (["ACC001", "ACC002", "ACC003", "ACC004"].includes(screen.screenId)) return <Profile currentSessionToken={currentSessionToken} screen={screen} user={user} />;
  if (screen.screenId >= "ACC005" && screen.screenId <= "ACC010") return <Subscription screen={screen} />;
  if (["ACC011", "ACC012", "ACC013"].includes(screen.screenId)) return <Orders screen={screen} />;
  if (["ACC014", "ACC015"].includes(screen.screenId)) return <Settings screen={screen} />;
  if (["ACC016", "ACC017"].includes(screen.screenId)) return <Progress screen={screen} />;
  if (screen.screenId === "ACC018") return <Achievements screen={screen} />;
  if (["ACC019", "ACC020", "ACC021"].includes(screen.screenId)) return <Support screen={screen} />;
  return <Invitations screen={screen} />;
}

export function AccountPage({ screen }: { screen: PageManifestEntry }) {
  const session = authClient.useSession();
  let page;
  if (session.isPending) {
    page = <><AccountHead screen={screen} description="Checking account session." /><p className="notice">Checking account session…</p></>;
  } else if (!session.data) {
    page = <><AccountHead screen={screen} description="A signed-in account is required." /><section className="card"><h2>Sign in required</h2><p>No account, order, progress, or support data is shown without an authenticated session.</p><a className="button button--gold" href="/auth/sign-in">Sign In</a></section></>;
  } else {
    page = <SignedInAccountPage currentSessionToken={session.data.session?.token} screen={screen} user={session.data.user} />;
  }
  return <AccountShell>{page}</AccountShell>;
}
