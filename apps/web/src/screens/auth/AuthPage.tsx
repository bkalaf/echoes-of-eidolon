import { useState } from "react";
import { useForm } from "react-hook-form";
import type { PageManifestEntry } from "../../lib/page-manifest";
import { AuthShell } from "../../components/shells/Shells";

type AuthFields = { email: string; password: string; username: string; code: string };

const authCopy: Record<string, { title: string; description: string; submit: string }> = {
  AUT008: { title: "Session Expired", description: "Your session has expired.", submit: "Sign in again" },
  AUTH01: { title: "Sign In", description: "Sign in to your Echoes of Eidolon account.", submit: "Sign In" },
  AUTH02: { title: "Sign Out", description: "End this session on this device.", submit: "Sign Out" },
  AUTH03: { title: "Sign Up", description: "Create your Echoes of Eidolon account.", submit: "Create Account" },
  AUTH04: { title: "Forgot Password", description: "Request a password reset link.", submit: "Send Reset Link" },
  AUTH05: { title: "Reset Password", description: "Choose a new password for this account.", submit: "Reset Password" },
  AUTH07: { title: "Redeem Invitation", description: "Use an invitation code to continue.", submit: "Redeem Invitation" },
  AUTH08: { title: "Two-Factor Challenge", description: "Enter the code from your authenticator.", submit: "Verify" },
  AUTH09: { title: "Passkeys", description: "Use a registered passkey to sign in.", submit: "Continue with a passkey" },
};

function VerifyEmailModal() {
  return <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="verify-email"><p className="kicker">VERIFY EMAIL</p><h2 id="verify-email">Check your email.</h2><p>Verification code sent to <strong>player@example.com</strong>.</p><label className="field">Verification code<input className="input" inputMode="numeric" /></label><p className="muted">The account remains unverified until the code succeeds.</p><div className="action-row"><button className="button">Back</button><button className="button">Resend</button><button className="button button--gold">Verify Email</button></div></section></div>;
}

export function AuthPage({ screen }: { screen: PageManifestEntry }) {
  const copy = authCopy[screen.screenId] ?? authCopy.AUTH03!;
  const [submitted, setSubmitted] = useState(false);
  const { register, handleSubmit, formState: { isValid } } = useForm<AuthFields>({ mode: "onChange" });
  const usesEmail = ["AUTH01", "AUTH03", "AUTH04", "AUTH05"].includes(screen.screenId);
  const usesPassword = ["AUTH01", "AUTH03", "AUTH05"].includes(screen.screenId);
  const usesUsername = screen.screenId === "AUTH03";
  const usesCode = ["AUTH07", "AUTH08"].includes(screen.screenId);

  return <AuthShell><main className="auth-page"><section className="auth-card"><p className="kicker">Account access</p><h1>{copy.title}</h1><p>{copy.description}</p>{screen.screenId === "AUT008" ? <a className="button button--gold" href="/auth/sign-in">Sign in again</a> : screen.screenId === "AUTH02" ? <div className="action-row"><a className="button" href="/">Cancel</a><button className="button button--gold">Sign Out</button></div> : <form onSubmit={handleSubmit(() => setSubmitted(true))}>{usesUsername && <label className="field">Username<input className="input" autoComplete="username" {...register("username", { required: true })} /></label>}{usesEmail && <label className="field">Email<input className="input" type="email" autoComplete="email" {...register("email", { required: true })} /></label>}{usesPassword && <label className="field">Password<input className="input" type="password" autoComplete={screen.screenId === "AUTH05" ? "new-password" : "current-password"} {...register("password", { required: true, minLength: 8 })} /></label>}{usesCode && <label className="field">{screen.screenId === "AUTH07" ? "Invitation code" : "Authentication code"}<input className="input" {...register("code", { required: true })} /></label>}{screen.screenId === "AUTH01" && <div className="auth-links"><a href="/auth/forgot-password">Forgot password?</a><a href="/auth/passkeys">Use a passkey</a></div>}<button className="button button--gold auth-submit" disabled={!isValid}>{copy.submit}</button>{submitted && <p className="notice notice--good" role="status">Submitted for server processing.</p>}</form>}</section>{screen.screenId === "AUTH03" && <aside className="auth-aside"><h2>Invitation required</h2><p>Registration continues only with valid invitation access.</p><a className="button" href="/auth/redeem-invitation">Redeem an invitation</a></aside>}</main>{screen.screenId === "AUTH06" && <VerifyEmailModal />}</AuthShell>;
}
