import { useEffect, useState, useSyncExternalStore } from "react";
import { useForm, useWatch } from "react-hook-form";

import { PasswordResetFields } from "../../components/auth/PasswordResetFields";
import { AuthShell } from "../../components/shells/Shells";
import { OtpInput, PasswordInput } from "../../components/ui/controls";
import { safeSignedInReturnPath } from "../../domain/auth-navigation";
import { passwordsMatch, pendingResetEmailKey, preserveResetIdentity } from "../../domain/password-workflows";
import type { AgeEligibility } from "../../generated/prisma/enums";
import { authClient } from "../../lib/auth-client";
import type { PageManifestEntry } from "../../lib/page-manifest";

type AuthFields = {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  code: string;
  eligibilityStatus: AgeEligibility;
};

const pendingVerificationEmailKey = "eidolon.auth.pending-verification-email";
const noSessionStorageSubscription = () => () => undefined;

function useSessionStorageValue(key: string): string {
  return useSyncExternalStore(
    noSessionStorageSubscription,
    () => window.sessionStorage.getItem(key) ?? "",
    () => "",
  );
}

const authCopy: Record<string, { title: string; description: string; submit: string }> = {
  AUT008: { title: "Session Expired", description: "Your session has expired.", submit: "Sign in again" },
  AUTH01: { title: "Sign In", description: "Sign in to your Echoes of Eidolon account.", submit: "Sign In" },
  AUTH02: { title: "Sign Out", description: "End this session on this device.", submit: "Sign Out" },
  AUTH03: { title: "Sign Up", description: "Create your Echoes of Eidolon account.", submit: "Create Account" },
  AUTH04: { title: "Forgot Password", description: "Enter your email address and we'll send you a password reset code.", submit: "Send Reset Code" },
  AUTH05: { title: "Reset Password", description: "Enter the 6-digit code sent to your email, then choose a new password.", submit: "Reset Password" },
  AUTH06: { title: "Verify Email", description: "Verify your email address to activate the account.", submit: "Verify Email" },
  AUTH07: { title: "Redeem Invitation", description: "Use an invitation code to continue.", submit: "Redeem Invitation" },
  AUTH08: { title: "Two-Factor Challenge", description: "Enter the 6-digit code.", submit: "Verify" },
  AUTH09: { title: "Passkeys", description: "Use a registered passkey to sign in.", submit: "Continue with a passkey" },
};

function resultError(result: { error: { message?: string } | null }): string | undefined {
  return result.error?.message ?? (result.error ? "The authentication request failed." : undefined);
}

function VerifyEmailModal({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const verify = async () => {
    setError(undefined);
    const result = await authClient.emailOtp.verifyEmail({ email, otp: code });
    const nextError = resultError(result);
    if (nextError) setError(nextError);
    else {
      window.sessionStorage.removeItem(pendingVerificationEmailKey);
      setMessage("Email verified. You can now sign in.");
    }
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

  return <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="verify-email"><p className="kicker">VERIFY EMAIL</p><h2 id="verify-email">Check your email.</h2><p>Enter the verification code sent to your email address.</p><label className="field">Email<input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field">Verification code<OtpInput value={code} onChange={(event) => setCode(event.target.value)} /></label><p className="muted">The account remains unverified until the code succeeds.</p>{error && <p className="notice notice--bad" role="alert">{error}</p>}{message && <p className="notice notice--good" role="status">{message}</p>}<div className="action-row"><a className="button" href="/auth/sign-up">Back</a><button className="button" disabled={!email} onClick={resend}>Resend</button>{message === "Email verified. You can now sign in." ? <a className="button button--gold" href="/auth/sign-in">Sign In</a> : <button className="button button--gold" disabled={!email || !/^\d{6}$/.test(code)} onClick={verify}>Verify Email</button>}</div></section></div>;
}

export function AuthPage({ screen }: { screen: PageManifestEntry }) {
  const [activeScreenId, setActiveScreenId] = useState(screen.screenId);
  const supported = Object.hasOwn(authCopy, activeScreenId);
  const copy = authCopy[activeScreenId] ?? {
    title: "Authentication unavailable",
    description: "This authentication screen is not registered.",
    submit: "Unavailable",
  };
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [resetCompleted, setResetCompleted] = useState(false);
  const signedInReturnPath = typeof window === "undefined"
    ? "/account/profile"
    : safeSignedInReturnPath(new URLSearchParams(window.location.search).get("returnTo"), window.location.origin);
  const pendingEmail = useSessionStorageValue(activeScreenId === "AUTH06" ? pendingVerificationEmailKey : pendingResetEmailKey);
  const { control, register, handleSubmit, getValues, setValue, formState: { isValid } } = useForm<AuthFields>({
    defaultValues: { code: "", confirmPassword: "", email: pendingEmail },
    mode: "onChange",
  });
  useEffect(() => {
    if (["AUTH05", "AUTH06"].includes(activeScreenId)) setValue("email", pendingEmail, { shouldValidate: true });
  }, [activeScreenId, pendingEmail, setValue]);
  const usesEmail = ["AUTH01", "AUTH03", "AUTH04"].includes(activeScreenId);
  const usesPassword = ["AUTH01", "AUTH03"].includes(activeScreenId);
  const usesUsername = activeScreenId === "AUTH03";
  const usesCode = ["AUTH07", "AUTH08"].includes(activeScreenId);
  const unsupported = false;
  const [watchedPassword, watchedConfirmation, watchedCode] = useWatch({
    control,
    name: ["password", "confirmPassword", "code"],
  });
  const resetFormInvalid = activeScreenId === "AUTH05"
    && (!passwordsMatch(watchedPassword, watchedConfirmation) || !/^\d{6}$/.test(watchedCode ?? ""));

  const submit = async (values: AuthFields) => {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      if (activeScreenId === "AUTH01") {
        const result = await authClient.signIn.email({
          callbackURL: signedInReturnPath,
          email: values.email,
          password: values.password,
        });
        const nextError = resultError(result);
        if (nextError) {
          setError(nextError);
        }
        else setMessage("Signed in.");
      } else if (activeScreenId === "AUTH03") {
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
        else {
          window.sessionStorage.setItem(pendingVerificationEmailKey, values.email);
          window.history.replaceState({}, "", "/auth/sign-up?state=AUTH06");
          setActiveScreenId("AUTH06");
          setMessage(undefined);
        }
      } else if (activeScreenId === "AUTH04") {
        const result = await authClient.emailOtp.requestPasswordReset({ email: values.email });
        const nextError = resultError(result);
        if (nextError) setError(nextError);
        else {
          preserveResetIdentity(values.email);
          window.history.replaceState({}, "", "/auth/reset-password");
          setActiveScreenId("AUTH05");
          setMessage("If the account exists, a reset code was sent.");
        }
      } else if (activeScreenId === "AUTH05") {
        if (!passwordsMatch(values.password, values.confirmPassword) || !/^\d{6}$/.test(values.code)) {
          setError("The reset code must contain six digits and both passwords must match.");
          return;
        }
        const result = await authClient.emailOtp.resetPassword({
          email: values.email,
          otp: values.code,
          password: values.password,
        });
        const nextError = resultError(result);
        if (nextError) setError(nextError);
        else {
          window.sessionStorage.removeItem(pendingResetEmailKey);
          setResetCompleted(true);
          setMessage(undefined);
        }
      } else if (activeScreenId === "AUTH07") {
        const response = await fetch("/api/beta-invitations/redeem", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: values.code }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) setError(result.error ?? "Invitation could not be redeemed.");
        else setMessage("Invitation redeemed. Beta access granted.");
      } else if (activeScreenId === "AUTH08") {
        const result = await authClient.twoFactor.verifyOtp({ code: values.code });
        const nextError = resultError(result);
        if (nextError) setError(nextError);
        else {
          setMessage("Two-factor verification completed.");
          window.location.assign(signedInReturnPath);
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The authentication request failed.");
    } finally {
      setBusy(false);
    }
  };

  const resendResetCode = async () => {
    setBusy(true);
    setError(undefined);
    const email = getValues("email");
    try {
      const result = await authClient.emailOtp.requestPasswordReset({ email });
      const nextError = resultError(result);
      if (nextError) setError(nextError);
      else setMessage("If the account exists, a new reset code was sent.");
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
      const result = await authClient.signIn.passkey({
        fetchOptions: {
          onSuccess: () => window.location.assign(signedInReturnPath),
        },
      });
      const nextError = resultError(result);
      if (nextError) {
        setError(nextError);
      }
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

  const title = resetCompleted ? "Password Reset" : copy.title;
  const description = resetCompleted ? undefined : copy.description;
  return <AuthShell><main className="auth-page"><section className="auth-card"><p className="kicker">Account access</p><h1>{title}</h1>{description && <p>{description}</p>}{resetCompleted ? <><p>Your password has been changed successfully.</p><p>Sign in with your new password.</p><a className="button button--gold auth-submit" href="/auth/sign-in">Sign In</a></> : !supported ? <p className="notice notice--warn">No authentication operation is available for an unregistered screen.</p> : activeScreenId === "AUT008" ? <a className="button button--gold" href="/auth/sign-in">Sign in again</a> : activeScreenId === "AUTH02" ? <div className="action-row"><a className="button" href="/">Cancel</a><button className="button button--gold" disabled={busy} onClick={signOut}>Sign Out</button></div> : activeScreenId === "AUTH09" ? <button className="button button--gold auth-submit" disabled={busy} onClick={signInWithPasskey}>{copy.submit}</button> : activeScreenId === "AUTH06" ? null : <form onSubmit={handleSubmit(submit)}>{usesUsername && <label className="field">Username<input className="input" autoComplete="username" {...register("username", { required: true })} /></label>}{usesEmail && <label className="field">Email<input className="input" type="email" autoComplete="email" {...register("email", { required: true })} /></label>}{usesPassword && <PasswordInput autoComplete={activeScreenId === "AUTH03" ? "new-password" : "current-password"} label="Password" {...register("password", { required: true })} />}{activeScreenId === "AUTH05" && <PasswordResetFields busy={busy} preservedEmail={pendingEmail} register={register} resend={resendResetCode} />}{activeScreenId === "AUTH03" && <fieldset className="field"><legend>Age eligibility</legend><label><input type="radio" value="ADULT_18_PLUS" {...register("eligibilityStatus", { required: true })} /> 18 or older</label><label><input type="radio" value="MINOR_14_17_GUARDIAN_CONSENTED" {...register("eligibilityStatus", { required: true })} /> 14–17; guardian consent evidence required before participation</label><p className="muted">No date of birth or exact age is collected. A minor may create an account, but cannot participate until an active guardian-consent record from an approved verification method exists.</p></fieldset>}{activeScreenId === "AUTH08" && <button className="button" type="button" disabled={busy} onClick={sendTwoFactorCode}>Send code</button>}{usesCode && <label className="field">{activeScreenId === "AUTH07" ? "Invitation code" : "6-digit code"}{activeScreenId === "AUTH07" ? <input className="input" {...register("code", { required: true })} /> : <OtpInput {...register("code", { required: true, pattern: /^[0-9]{6}$/ })} />}</label>}{activeScreenId === "AUTH01" && <div className="auth-links"><a href="/auth/forgot-password">Forgot password?</a><a href="/auth/passkeys">Use a passkey</a></div>}<button className="button button--gold auth-submit" disabled={!isValid || busy || unsupported || resetFormInvalid}>{busy ? "Working…" : copy.submit}</button></form>}{error && <p className="notice notice--bad" role="alert">{error}</p>}{message && <p className="notice notice--good" role="status">{message}</p>}</section>{activeScreenId === "AUTH03" && <aside className="auth-aside"><h2>Privacy-minimal signup</h2><p>Adults store only ADULT_18_PLUS. The application does not collect date of birth or exact age.</p><p className="notice">Under 14 is ineligible.</p></aside>}</main>{activeScreenId === "AUTH06" && <VerifyEmailModal key={pendingEmail || "pending-verification"} initialEmail={pendingEmail} />}</AuthShell>;
}
