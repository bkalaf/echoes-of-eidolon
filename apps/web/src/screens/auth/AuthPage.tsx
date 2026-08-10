import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthShell } from "../../components/shells/Shells";
import { safeSignedInReturnPath } from "../../domain/auth-navigation";
import { authClient } from "../../lib/auth-client";
import type { PageManifestEntry } from "../../lib/page-manifest";

type AuthFields = {
  email: string;
  password: string;
  username: string;
  code: string;
  eligibilityStatus: "ADULT_18_PLUS" | "MINOR_14_17_GUARDIAN_CONSENTED";
};

const authCopy: Record<string, { title: string; description: string; submit: string }> = {
  AUT008: { title: "Session Expired", description: "Your session has expired.", submit: "Sign in again" },
  AUTH01: { title: "Sign In", description: "Sign in to your Echoes of Eidolon account.", submit: "Sign In" },
  AUTH02: { title: "Sign Out", description: "End this session on this device.", submit: "Sign Out" },
  AUTH03: { title: "Sign Up", description: "Create your Echoes of Eidolon account.", submit: "Create Account" },
  AUTH04: { title: "Forgot Password", description: "Request a password reset code.", submit: "Send Reset Code" },
  AUTH05: { title: "Reset Password", description: "Use the emailed code and choose a new password.", submit: "Reset Password" },
  AUTH07: { title: "Redeem Invitation", description: "Use an invitation code to continue.", submit: "Redeem Invitation" },
  AUTH08: { title: "Two-Factor Challenge", description: "Enter the 6-digit code.", submit: "Verify" },
  AUTH09: { title: "Passkeys", description: "Use a registered passkey to sign in.", submit: "Continue with a passkey" },
};

function resultError(result: { error: { message?: string } | null }): string | undefined {
  return result.error?.message ?? (result.error ? "The authentication request failed." : undefined);
}

function VerifyEmailModal() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const verify = async () => {
    setError(undefined);
    const result = await authClient.emailOtp.verifyEmail({ email, otp: code });
    const nextError = resultError(result);
    if (nextError) setError(nextError);
    else setMessage("Email verified.");
  };

  const resend = async () => {
    setError(undefined);
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    const nextError = resultError(result);
    if (nextError) setError(nextError);
    else setMessage("A new verification code was sent.");
  };

  return <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="verify-email"><p className="kicker">VERIFY EMAIL</p><h2 id="verify-email">Check your email.</h2><p>Enter the verification code sent to your email address.</p><label className="field">Email<input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field">Verification code<input className="input" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} /></label><p className="muted">The account remains unverified until the code succeeds.</p>{error && <p className="notice notice--bad" role="alert">{error}</p>}{message && <p className="notice notice--good" role="status">{message}</p>}<div className="action-row"><a className="button" href="/auth/sign-up">Back</a><button className="button" disabled={!email} onClick={resend}>Resend</button><button className="button button--gold" disabled={!email || !code} onClick={verify}>Verify Email</button></div></section></div>;
}

export function AuthPage({ screen }: { screen: PageManifestEntry }) {
  const copy = authCopy[screen.screenId] ?? authCopy.AUTH03!;
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const invitationId = screen.screenId === "AUTH07" && typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("id") ?? ""
    : "";
  const signedInReturnPath = typeof window === "undefined"
    ? "/account/profile"
    : safeSignedInReturnPath(new URLSearchParams(window.location.search).get("returnTo"), window.location.origin);
  const { register, handleSubmit, formState: { isValid } } = useForm<AuthFields>({
    defaultValues: { code: invitationId },
    mode: "onChange",
  });
  const usesEmail = ["AUTH01", "AUTH03", "AUTH04", "AUTH05"].includes(screen.screenId);
  const usesPassword = ["AUTH01", "AUTH03", "AUTH05"].includes(screen.screenId);
  const usesUsername = screen.screenId === "AUTH03";
  const usesCode = ["AUTH05", "AUTH07", "AUTH08"].includes(screen.screenId);
  const unsupported = false;

  const submit = async (values: AuthFields) => {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      if (screen.screenId === "AUTH01") {
        const result = await authClient.signIn.email({
          callbackURL: signedInReturnPath,
          email: values.email,
          password: values.password,
        });
        const nextError = resultError(result);
        if (nextError) setError(nextError);
        else setMessage("Signed in.");
      } else if (screen.screenId === "AUTH03") {
        const result = await authClient.signUp.email({
          email: values.email,
          password: values.password,
          name: values.username,
          username: values.username,
          displayUsername: values.username,
          eligibilityStatus: values.eligibilityStatus,
        });
        const nextError = resultError(result);
        if (nextError) setError(nextError);
        else setMessage("Account created. Check your email for the verification code.");
      } else if (screen.screenId === "AUTH04") {
        const result = await authClient.emailOtp.requestPasswordReset({ email: values.email });
        const nextError = resultError(result);
        if (nextError) setError(nextError);
        else setMessage("If the account exists, a reset code was sent.");
      } else if (screen.screenId === "AUTH05") {
        const result = await authClient.emailOtp.resetPassword({
          email: values.email,
          otp: values.code,
          password: values.password,
        });
        const nextError = resultError(result);
        if (nextError) setError(nextError);
        else setMessage("Password reset completed.");
      } else if (screen.screenId === "AUTH07") {
        const response = await fetch("/api/beta-invitations/redeem", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: values.code }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) setError(result.error ?? "Invitation could not be redeemed.");
        else setMessage("Invitation redeemed. Beta access granted.");
      } else if (screen.screenId === "AUTH08") {
        const result = await authClient.twoFactor.verifyOtp({ code: values.code });
        const nextError = resultError(result);
        if (nextError) setError(nextError);
        else setMessage("Two-factor verification completed.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The authentication request failed.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    const result = await authClient.signOut();
    setBusy(false);
    const nextError = resultError(result);
    if (nextError) setError(nextError);
    else setMessage("Signed out.");
  };

  const signInWithPasskey = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await authClient.signIn.passkey();
      const nextError = resultError(result);
      if (nextError) setError(nextError);
      else setMessage("Passkey accepted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Passkey authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const sendTwoFactorCode = async () => {
    setBusy(true);
    setError(undefined);
    const result = await authClient.twoFactor.sendOtp();
    setBusy(false);
    const nextError = resultError(result);
    if (nextError) setError(nextError);
    else setMessage("A two-factor code was sent to the account email.");
  };

  return <AuthShell><main className="auth-page"><section className="auth-card"><p className="kicker">Account access</p><h1>{copy.title}</h1><p>{copy.description}</p>{screen.screenId === "AUT008" ? <a className="button button--gold" href="/auth/sign-in">Sign in again</a> : screen.screenId === "AUTH02" ? <div className="action-row"><a className="button" href="/">Cancel</a><button className="button button--gold" disabled={busy} onClick={signOut}>Sign Out</button></div> : screen.screenId === "AUTH09" ? <button className="button button--gold auth-submit" disabled={busy} onClick={signInWithPasskey}>{copy.submit}</button> : <form onSubmit={handleSubmit(submit)}>{usesUsername && <label className="field">Username<input className="input" autoComplete="username" {...register("username", { required: true, minLength: 3, maxLength: 30 })} /></label>}{usesEmail && <label className="field">Email<input className="input" type="email" autoComplete="email" {...register("email", { required: true })} /></label>}{usesPassword && <label className="field">Password<input className="input" type="password" autoComplete={["AUTH03", "AUTH05"].includes(screen.screenId) ? "new-password" : "current-password"} {...register("password", { required: true, minLength: 8 })} /></label>}{screen.screenId === "AUTH03" && <fieldset className="field"><legend>Age eligibility</legend><label><input type="radio" value="ADULT_18_PLUS" {...register("eligibilityStatus", { required: true })} /> 18 or older</label><label><input type="radio" value="MINOR_14_17_GUARDIAN_CONSENTED" disabled /> 14–17 with verified guardian consent</label><p className="muted">No date of birth or exact age is collected. Minor signup remains unavailable until the guardian-consent evidence and verification method are supplied.</p></fieldset>}{screen.screenId === "AUTH08" && <button className="button" type="button" disabled={busy} onClick={sendTwoFactorCode}>Send code</button>}{usesCode && <label className="field">{screen.screenId === "AUTH07" ? "Invitation code" : screen.screenId === "AUTH08" ? "6-digit code" : "Reset code"}<input className="input" inputMode="numeric" {...register("code", { required: true, ...(screen.screenId === "AUTH08" ? { minLength: 6, maxLength: 6 } : {}) })} /></label>}{screen.screenId === "AUTH01" && <div className="auth-links"><a href="/auth/forgot-password">Forgot password?</a><a href="/auth/passkeys">Use a passkey</a></div>}<button className="button button--gold auth-submit" disabled={!isValid || busy || unsupported}>{busy ? "Working…" : copy.submit}</button></form>}{error && <p className="notice notice--bad" role="alert">{error}</p>}{message && <p className="notice notice--good" role="status">{message}</p>}</section>{screen.screenId === "AUTH03" && <aside className="auth-aside"><h2>Privacy-minimal signup</h2><p>Adults store only ADULT_18_PLUS. The application does not collect date of birth or exact age.</p><p className="notice">Under 14 is ineligible.</p></aside>}</main>{screen.screenId === "AUTH06" && <VerifyEmailModal />}</AuthShell>;
}
