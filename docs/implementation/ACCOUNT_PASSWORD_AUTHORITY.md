# Account password workflow authority reconciliation

## Sources searched

The account password remediation searched the current application authority before adding a screen:

- `apps/web/src/data/page-manifest.json` and `page-manifest-v3-amendments.json`
- current `docs/`, release notes, implementation audits, and owner-decision references
- current R008-to-current and 0.2.0 prompt packs
- current local Codex attachments and searchable memory registry
- repository Git history for password-control and change-password strings
- indexed account/security wireframe inventories and screen matrices available on this workstation
- current `AccountPage`, `AuthPage`, shared controls, and authentication tests
- the installed Better Auth 1.6.25 client/server endpoint contract

ACC001 through ACC023 and ACC030 were present, but no later authored account change-password screen or reusable Password control was found. AUTH05 was the only current password-management screen and owns recovery by email OTP.

## Reconciled implementation

The owner-authored remediation therefore supplies the minimal fallback screen state `ACC024` in the existing `/account/profile` modal architecture. It uses Better Auth's authenticated `changePassword` operation with current and new passwords, preserves the current session according to the provider default, and does not create a custom credential verifier.

`Forgot your current password?` requests the existing password-reset OTP, preserves only the account email in session storage, and enters AUTH05. It does not implement a second recovery service or copy the reset form into Account.

The shared `PasswordInput`, `OtpInput`, password-match rule, and AUTH05 reset fields are the canonical implementation owners used by authentication and account surfaces.

## Read-only control audit

Purely informational Username, Email, Current email, and an existing capability's stable code are static semantic values and do not enter the tab sequence. The capability code retains a hidden submission value because the immutable identifier is still required by its version-creation request. Remaining `disabled` usages represent genuinely unavailable actions, conditional settings, or immutable primary-key editing and intentionally use native disabled semantics.
