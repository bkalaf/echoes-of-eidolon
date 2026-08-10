import { useState } from "react";
import type { ReactNode } from "react";

import { AccountShell } from "../../components/shells/Shells";
import { authClient } from "../../lib/auth-client";
import type { PageManifestEntry } from "../../lib/page-manifest";

interface AccountUser {
  displayUsername?: string | null;
  email: string;
  name: string;
  username?: string | null;
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

function Profile({ screen, user }: { screen: PageManifestEntry; user: AccountUser }) {
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

  return <><AccountHead screen={screen} description="Account identity and profile details." /><div className="split"><section className="card form-grid"><label className="field">Username<input className="input" value={user.displayUsername ?? user.username ?? ""} readOnly /></label><label className="field">Email<input className="input" value={user.email} readOnly /></label><label className="field span-2">Display name<input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><button className="button button--gold" disabled={busy || !displayName.trim()} onClick={saveName}>Save changes</button></section><aside className="card"><h2>Account</h2><p>Email changes require verification.</p><p>Username cannot be changed.</p><a className="button" href="/account/profile?state=ACC002">Change email</a><h3>Authorized sessions</h3><p>Session inventory is provided by Better Auth; session-management UI remains owner-deferred.</p></aside></div>{error && <p className="notice notice--bad" role="alert">{error}</p>}{message && <p className="notice notice--good" role="status">{message}</p>}{modal && <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="change-email-title"><p className="kicker">CHANGE EMAIL</p><h2 id="change-email-title">{emailStep === "verify" ? "Verify the new email address." : "Change account email."}</h2>{emailStep === "verify" ? <><label className="field">New email<input className="input" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><label className="field">Verification code<input className="input" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} /></label><p>The current account email is unchanged until verification succeeds.</p></> : <><label className="field">New email<input className="input" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><label className="field">Current password<input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label></>}<div className="action-row"><a className="button" href="/account/profile">Back</a>{emailStep === "verify" && <button className="button" disabled={busy || !newEmail} onClick={sendChangeEmailCode}>Resend</button>}<button className="button button--gold" disabled={busy || !newEmail || (emailStep === "request" ? !password : !code)} onClick={emailStep === "verify" ? changeEmail : sendChangeEmailCode}>{emailStep === "verify" ? "Verify & Change Email" : "Send Verification"}</button></div></section></div>}</>;
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
  return <><AccountHead screen={screen} description="Request an invitation for another participant." /><Deferred>Invitation issuance, request persistence, review states, and redemption verification are not supplied.</Deferred></>;
}

function BetaLanding({ screen }: { screen: PageManifestEntry }) {
  return <><AccountHead screen={screen} description="Authenticated account landing." /><div className="grid-2"><section className="card"><h2>Account access</h2><p>The Better Auth session is active.</p><a className="button" href="/account/profile">View profile</a></section><Deferred>Beta participation and MEMBER/USER access require an account-access owner and role model.</Deferred></div></>;
}

function SignedInAccountPage({ screen, user }: { screen: PageManifestEntry; user: AccountUser }) {
  if (screen.screenId === "ACC030") return <BetaLanding screen={screen} />;
  if (["ACC001", "ACC002", "ACC003", "ACC004"].includes(screen.screenId)) return <Profile screen={screen} user={user} />;
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
    page = <SignedInAccountPage screen={screen} user={session.data.user} />;
  }
  return <AccountShell>{page}</AccountShell>;
}
