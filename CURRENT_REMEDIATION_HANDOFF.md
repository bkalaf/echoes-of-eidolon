# Resolved Blockers Remediation — Completion Handoff

Date completed locally: 2026-08-11
Repository: `/home/bobby/echoes-of-eidolon`
Branch: `main`
Starting SHA: `66263041d1bd0e9752a32fe278a743aa33665213`

## Boundary

The scoped remediation and complete verification gate are finished. The revision containing this file is the remediation commit.

Do not deploy, publish a release, run production migrations, restart production services, mutate production data, or activate/mutate production provider configuration. The requested terminal action is: finish the green remediation, commit it to `main`, push it, then stop.

## Controlling request

Complete the five scoped areas from the “Echoes of Eidolon — Resolved Blockers Remediation Prompt”:

1. fourteen legal-document screens;
2. age eligibility and guardian-consent application gating;
3. Stripe subscription lifecycle;
4. Help Tickets, Store Support, returns, and guest-order support;
5. Found City naming handoff.

The newer root package `Echoes_of_Eidolon_Legal_0.2.0.zip` supersedes the earlier instruction that legal documents were drafts. Its exact status is:

- `OWNER APPROVED — 0.2.0`
- `NOT PUBLISHED — DEPLOYMENT AUTHORIZATION NOT GRANTED`

Owner approval does not authorize publication, deployment, filing, or an effective date.

## Implemented in the current working tree

### Legal

- Copied all fourteen substantive documents from the attached legal ZIP into `apps/web/src/content/legal/`.
- Added the legal register and consistency report from the package.
- Added `legal-documents.ts` and a bounded Markdown renderer.
- `/legal` lists exactly fourteen documents; every canonical package slug resolves and renders substantive content.
- UI distinguishes owner approval from publication/deployment status.
- Added unit and Playwright coverage.

### Age and guardian consent

- Added `GuardianConsentRecord` and its forward migration.
- Adult participation is eligible from attestation.
- Minor participation requires an active, non-revoked consent record with nonblank verification provenance.
- No DOB or numeric-age input was added.
- Account existence, payment, membership, invitation, admin, and owner role do not bypass participation eligibility.
- The jurisdiction-specific verification method/vendor remains a narrow launch-compliance sub-gate; none was invented.

### Subscription

- Added server-owned `MembershipSubscription` and append-only provider events.
- Added Stripe Checkout, customer portal, period-end cancellation, membership projection, and ACC005–ACC010 UI states.
- Price is `$9.99 per calendar month`; Member remains entitlement rather than authorization role.
- Checkout establishes provider identity; only `invoice.paid` appends Member time, preventing double grant.
- Provider metadata recovers out-of-order invoice/subscription webhooks.
- Outer webhook processing remains idempotent.
- Added server, component, ledger-boundary, and admin-projection tests.
- Refund/proration/dunning/grace rules remain narrow fail-closed operations because authority is absent.

### Help Tickets, returns, Store Support, guest orders

- Added first-party Help Ticket, message, attachment, return-request, and private order-token persistence.
- Account Support has Open/Resolved/Create tabs, actual form, ownership-checked detail, replies, and bounded attachments.
- Return intake requires an owned order with persisted eligibility and does not issue a refund or change Printful fulfillment.
- Store Support requires account ownership or a valid private guest token and uses the approved order-support categories.
- Guest checkout is supported with receipt email; lookup is rate limited and privacy safe.
- Private status projection excludes customer email, card data, and provider identifiers.
- Existing admin commerce screens now project guest orders safely, show persisted subscriptions, and expose order-linked return/support intake without granting refund authority.
- Added SUPPORT-001 and ORDER-001 Playwright coverage plus server/component tests.

### Found City

- Added the approved Atlas naming/proximity supplement as a bundled reference and an idempotent fail-closed importer.
- The bundled file was initially discovered truncated and was replaced from the owner ZIP. Verified SHA-256:
  `df12606c3d127b5f30a64205888a058bfea5866f5c07dce959f266765f18b922`.
- The reference parses as 400 Sites, 356 nameable features, and 1,780 eligibility mappings.
- Found City inherits the current World from the Sites workspace and has no independent World selector.
- UI and service use Breed rows, projected-year caps, full origin subtraction, canonical integer 90% arrival/loss, and one serializable transaction.
- Founding persists a server-authored immutable PromptVersion; it never calls an LLM automatically.
- Exact copy/validate/apply naming handoff is implemented with raw-response provenance, strict ID/set validation, named-feature protection, and atomic application.
- Added service, UI, and exact-reference tests.

### Audit

`docs/implementation/WIREFRAME_IMPLEMENTATION_STATUS_AUDIT.md` was updated row by row. It mechanically reconciles to:

- IMPLEMENTED: 235
- PARTIAL: 24
- PLACEHOLDER: 14
- active V3 states: 273

The three superseded Matrix entity rows remain forensic and excluded from the active count.

## Migration

One forward-only migration was added:

`apps/web/prisma/migrations/20260811010000_resolved_blockers_application_contracts/migration.sql`

Historical migrations were not modified.

The migration verifier applies all 31 migrations to a clean database and to the historical replay fixture with no schema drift.

## Atlas R10 source package received

- The owner added the root `atlas/` directory to `.gitignore`; that exact change is preserved.
- `08_globe_and_metadata.zip` SHA-256: `baf726c8f82fb8a6d85bb65a6372666f4980f169353318918b4ed0c0bda2fa50`.
- The package manifest declares 97 files, including 93 PNG Atlas images.
- The newest filter authority is `EIDOLON_ATLAS_IMAGE_PACK_R10_FILTERS_PATCH_V2.zip`, SHA-256 `552e08fab8f4bc4eaceec7a8dce16cf6e0d82ca088b35be18d5d247140fa7a47`.
- V2 exposes exactly `Concord`, `Schism`, and `Ruin` under `Faction Control`; it removes `Initial` from the visible selector.
- The source package remains ignored and was not uploaded to Spaces or activated in production because this remediation expressly forbids provider mutation and deployment.

## Final verified results

- Prisma generation: passed; 35 entity-admin contracts generated.
- Migration verification: passed; all 31 migrations apply and both clean and historical replay schemas have no drift.
- Wireframe reconciliation: passed; 269 exact base rows and 273 mechanically derived active rows.
- Lint: passed.
- TypeScript: passed.
- Unit: 93 files passed, 494 tests passed.
- Integration: 6 files passed, 32 tests passed.
- Playwright: 13 tests passed.
- Production build: passed.
- Cumulative `pnpm verify`: passed.

## Remaining narrow boundaries

- A jurisdiction-specific guardian verification method/vendor is not owner-authorized and was not invented.
- Subscription refund/proration and dunning/grace behavior remains fail-closed where authority is absent.
- Counsel-dependent legal fields identified in the owner package remain explicit and prevent production publication, not implementation of the legal screens.
- Atlas R10 managed-asset publication, production data import, provider configuration, database migration deployment, service restart, release publication, and application deployment were not performed.

## Terminal boundary

Commit the green state to `main`, push it, verify `origin/main`, and stop. Do not deploy or publish.
