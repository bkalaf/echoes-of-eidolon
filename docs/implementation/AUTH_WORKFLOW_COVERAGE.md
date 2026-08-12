# Authentication workflow coverage

This matrix distinguishes browser traversal from component tests. `tests/e2e/auth.spec.ts` runs Chromium against the real application server, Better Auth routes, PostgreSQL, and browser cookies. Every disposable identity is deleted by its exact generated username after each test, including failure paths. A test-only OTP capture sink is enabled only for E2E runs and is rejected when `NODE_ENV=production`.

| Workflow | Entry / initial state | Inputs and operation | Success / next state | Failure state | Unit | Integration | Browser E2E | Production-safe verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH01 Sign in | `/auth/sign-in`; signed out | email, password; Better Auth email sign-in | session; bounded `returnTo` or `/account/profile` | generic Better Auth error; no queued soundtrack | yes | yes | yes: valid, invalid, unverified, safe/unsafe return | owner credential sign-in and authorized destination |
| AUTH02 Sign out | `/auth/sign-out`; authenticated | confirmation; Better Auth sign-out | session removed; public/signed-out state | error remains on screen | yes | yes | yes: protected account page becomes unavailable | sign out a controlled session, then sign back in |
| AUTH03 Sign up | `/auth/sign-up`; signed out | username, email, password, eligibility; Better Auth sign-up | AUTH06 verification modal | validation or privacy-safe service error | yes | yes | yes: real account and OTP delivery | controlled disposable account only |
| AUTH04 Forgot password | `/auth/forgot-password`; email known or unknown | email; request reset OTP | replaces URL/state with AUTH05 and preserves email in session storage | privacy-safe account-existence wording | yes | yes | yes: transition is required | submit owner email; verify AUTH05 appears without consuming OTP |
| AUTH05 Reset password | `/auth/reset-password`; preserved email optional | email, six-digit `OtpInput`, new password, confirmation; reset OTP | code consumed; Sign In action | malformed/mismatched disabled; wrong/expired/used/rate-limit error | yes | yes | yes: resend, paste, reset, old fails/new succeeds, refresh fallback | local controlled credential; production structural check without rotating an owner unintentionally |
| AUTH06 Verify email | modal from signup; direct fallback may request email | email, six-digit `OtpInput`; verify/resend OTP | verified account and Sign In action | wrong/expired code remains unverified | yes | yes | yes: wrong, resend, valid | controlled disposable account only |
| AUTH07 Redeem invitation | `/auth/redeem-invitation`; authenticated matching account | one-time bearer code; persisted invitation redemption | `betaEligible=true`; no organization-role mutation | invalid/expired/revoked/used error | yes | yes | yes: invalid, valid, used, membership count unchanged, no URL bearer | controlled pre-created invitation only |
| AUTH08 Two-factor challenge | `/auth/two-factor`; valid first factor and 2FA cookie | send email OTP; six-digit `OtpInput`; verify | authenticated session; bounded account destination | protected API is 401 before verification; wrong OTP fails | yes | yes | yes: send, malformed, wrong, resend, valid | controlled 2FA account only |
| AUTH09 Passkey | `/auth/passkeys`; signed out | platform WebAuthn assertion | session and bounded `returnTo` when a registered credential exists | cancellation/missing credential fails closed | yes | Better Auth route coverage | partial: real browser cancellation/no-credential and no session | successful registration/authentication cannot be automated through current UI because no passkey enrollment/removal surface is exposed |
| AUT008 Session expired | `/auth/session-expired`; invalid/expired session | Sign in again | AUTH01; bounded return | no expired session is treated as authenticated | yes | yes | yes: expired state and unsafe return rejection | revoke controlled session and sign in again |
| Owner bootstrap/sign-in | CLI with canonical config; absent owner or explicit rotation | canonical secret file, email, username; create/verify hash | owner, verified email, credential verified; browser sign-in; owner destination | conflicts/mismatch fail closed; existing credential never silently replaced | yes | script + database | browser sign-in after bootstrap | run canonical loader, explicit rotation only when authorized, then owner route check |

## Account-security audit

| Workflow | Current production surface | Browser evidence |
| --- | --- | --- |
| Display-name/settings persistence | Account profile | saved and persists after reload |
| Change email and resend | ACC002/ACC003 modal using the dedicated OTP control | wrong OTP, resend, successful change, sign-in under new email |
| Session listing | ACC004 | two other browser sessions are listed |
| Revoke one session | ACC004 | one selected other browser session becomes unauthorized |
| Revoke all other sessions | ACC004 | all remaining other sessions become unauthorized; current session remains |
| Invitation request/redeem and eligibility | Public request plus AUTH07 | redemption grants only beta eligibility; no organization membership change |
| Password change while signed in | No current application route or control | not browser-testable until an owner-approved workflow exists; password reset is fully covered |
| Passkey enrollment/removal | No current application route or control | authentication cancellation/failure is covered; successful WebAuthn lifecycle awaits an enrollment surface |
| Two-factor enrollment/disable | No current application route or control | the email OTP sign-in challenge is fully covered; enrollment/disable awaits an owner-approved account-security surface |

## Regression identified

Before this remediation, AUTH04 displayed a success notice after delivery but did not transition to AUTH05. AUTH05 had one password field, no confirmation, and no resend action. Existing browser tests covered page rendering and unrelated routes but never traversed a real Better Auth password-reset mutation. The dedicated suite now treats successful end state and credential behavior as the evidence boundary.

## Owner bootstrap incident

The previous generic secret runner merged canonical files first and then `process.env`, so an inherited shell value could override `OWNER_BOOTSTRAP_SECRET`. Its local-only config contract also did not accept the production `/etc/eidolon/config.json` path. The owner-specific runner now requires an explicit config, reads locked regular secret files, applies those canonical values after the inherited environment, identifies the source without printing it, verifies the stored credential, and refuses to rotate an existing mismatch unless `--rotate-existing-credential` is explicitly supplied. Migration verification creates locked temporary canonical files and exercises that same runner against a fresh database.
