# Legal Consistency Report

**Version:** `0.2.0`  
**Status:** `OWNER APPROVED — 0.2.0`  
**Research/consistency review date:** 2026-08-11  
**Deployment authorization:** Not granted by this report.

## 1. Fourteen-document inventory

| # | File | Draft status | Scope check |
|---:|---|---|---|
| 1 | `01_TERMS_OF_SERVICE.md` | Complete | General terms and all core cross-references |
| 2 | `02_PRIVACY_POLICY.md` | Complete | Data categories, AI/provider split, retention, rights |
| 3 | `03_COOKIE_POLICY.md` | Complete | Essential vs optional storage, Stripe payment storage |
| 4 | `04_ACCESSIBILITY_STATEMENT.md` | Complete | No unverified conformance claim; feedback route |
| 5 | `05_ACCEPTABLE_USE_AND_PLAYER_CONDUCT.md` | Complete | Conduct, AI/security abuse, moderation/review |
| 6 | `06_BETA_AND_INVITATION_PARTICIPATION_TERMS.md` | Complete | Invite-only; payment does not buy access |
| 7 | `07_MEMBERSHIP_AND_SUBSCRIPTION_TERMS.md` | Complete | $9.99/calendar month; anchor semantics; Stripe |
| 8 | `08_DONATIONS_AND_PERKS_TERMS.md` | Complete | $10–$100; exact grant formula; refund ledger rules |
| 9 | `09_STORE_TERMS_OF_SALE.md` | Complete | Guest checkout; Stripe payment; Printful fulfillment |
| 10 | `10_SHIPPING_AND_FULFILLMENT_POLICY.md` | Complete | Estimates; address/tracking/split shipments |
| 11 | `11_RETURNS_REFUNDS_CANCELLATION_POLICY.md` | Complete | Required A–G remedy separation |
| 12 | `12_INTELLECTUAL_PROPERTY_AND_FAN_CONTENT_POLICY.md` | Complete | Original IP, public-domain/culture boundary, fan rules |
| 13 | `13_AI_AUTOMATED_INTERACTION_AND_PLAYER_CONTENT_DISCLOSURE.md` | Complete | Probabilistic output; OpenAI; non-persistence |
| 14 | `14_CULTURAL_USE_ATTRIBUTION_AND_RESEARCH_CORRECTIONS_POLICY.md` | Complete | Provenance, corrections, sacred/restricted-use review |

The package also includes this report and `LEGAL_DOCUMENT_REGISTER.md`, for **16 files total**.

## 2. Status of each file

All fourteen public legal documents were generated as substantive standalone Markdown pages with title, slug, version 0.2.0, status `OWNER APPROVED — 0.2.0`, `[PROPOSED EFFECTIVE DATE]`, audience, plain-language summary, numbered table of contents, numbered substantive sections, help/contact routing, related-document cross-references, and version notes. No document is marked deployed, published, filed, or legally effective.

## 3. Remaining placeholders

- `[ADDRESS CHANGE CUTOFF/PROCESS]` — present in: `10_SHIPPING_AND_FULFILLMENT_POLICY.md`, `11_RETURNS_REFUNDS_CANCELLATION_POLICY.md`
- `[ANALYTICS CONFIGURATION — IF ENABLED]` — present in: `03_COOKIE_POLICY.md`
- `[CONFIGURED ORDER ACCEPTANCE POINT]` — present in: `09_STORE_TERMS_OF_SALE.md`
- `[CONFIGURED RETURN/CLAIM WINDOW]` — present in: `09_STORE_TERMS_OF_SALE.md`, `10_SHIPPING_AND_FULFILLMENT_POLICY.md`, `11_RETURNS_REFUNDS_CANCELLATION_POLICY.md`
- `[COOKIE PREFERENCE CONTROL LOCATION]` — present in: `03_COOKIE_POLICY.md`
- `[COURT VENUE]` — present in: `01_TERMS_OF_SERVICE.md`
- `[CUSTOMS/IMPORT DUTIES RULE]` — present in: `09_STORE_TERMS_OF_SALE.md`, `10_SHIPPING_AND_FULFILLMENT_POLICY.md`
- `[DMCA AGENT — IF REGISTERED]` — present in: `12_INTELLECTUAL_PROPERTY_AND_FAN_CONTENT_POLICY.md`
- `[GOVERNING LAW]` — present in: `01_TERMS_OF_SERVICE.md`
- `[LEGAL ENTITY NAME]` — present in: `01_TERMS_OF_SERVICE.md`, `02_PRIVACY_POLICY.md`, `09_STORE_TERMS_OF_SALE.md`, `LEGAL_DOCUMENT_REGISTER.md`
- `[LIABILITY CAP]` — present in: `01_TERMS_OF_SERVICE.md`
- `[MONETIZED VIDEO/STREAMING PERMISSION]` — present in: `12_INTELLECTUAL_PROPERTY_AND_FAN_CONTENT_POLICY.md`
- `[PROPOSED EFFECTIVE DATE]` — present in: `01_TERMS_OF_SERVICE.md`, `02_PRIVACY_POLICY.md`, `03_COOKIE_POLICY.md`, `04_ACCESSIBILITY_STATEMENT.md`, `05_ACCEPTABLE_USE_AND_PLAYER_CONDUCT.md`, `06_BETA_AND_INVITATION_PARTICIPATION_TERMS.md`, `07_MEMBERSHIP_AND_SUBSCRIPTION_TERMS.md`, `08_DONATIONS_AND_PERKS_TERMS.md`, `09_STORE_TERMS_OF_SALE.md`, `10_SHIPPING_AND_FULFILLMENT_POLICY.md`, `11_RETURNS_REFUNDS_CANCELLATION_POLICY.md`, `12_INTELLECTUAL_PROPERTY_AND_FAN_CONTENT_POLICY.md`, `13_AI_AUTOMATED_INTERACTION_AND_PLAYER_CONTENT_DISCLOSURE.md`, `14_CULTURAL_USE_ATTRIBUTION_AND_RESEARCH_CORRECTIONS_POLICY.md`, `LEGAL_DOCUMENT_REGISTER.md`
- `[STORE/ORDER SUPPORT ROUTE]` — present in: `01_TERMS_OF_SERVICE.md`, `02_PRIVACY_POLICY.md`, `04_ACCESSIBILITY_STATEMENT.md`, `09_STORE_TERMS_OF_SALE.md`, `10_SHIPPING_AND_FULFILLMENT_POLICY.md`, `11_RETURNS_REFUNDS_CANCELLATION_POLICY.md`
- `[SUPPORTED JURISDICTIONS]` — present in: `02_PRIVACY_POLICY.md`
- `[VERIFIED ACCESSIBILITY LIMITATIONS]` — present in: `04_ACCESSIBILITY_STATEMENT.md`

Each placeholder is narrow and represents an unresolved legal, jurisdictional, provider, or deployment fact. None replaces an owner rule already resolved in the drafting authority.

## 4. Jurisdiction-specific or configuration-dependent clauses

- **Contracting entity:** `[LEGAL ENTITY NAME]` must be replaced only from authoritative formation/business records.
- **Governing law and venue:** `[GOVERNING LAW]` and `[COURT VENUE]` require owner/counsel approval. No arbitration or class-waiver clause was added.
- **Supported jurisdictions / international processing:** `[SUPPORTED JURISDICTIONS]` must match launch availability and any required transfer mechanism.
- **Liability cap:** `[LIABILITY CAP]` requires counsel/owner approval; mandatory-law savings language is already included.
- **Merchandise claim/return timing:** `[CONFIGURED RETURN/CLAIM WINDOW]` remains unresolved. No numeric return period was invented.
- **Order acceptance:** `[CONFIGURED ORDER ACCEPTANCE POINT]` must match the production payment/fulfillment state machine.
- **Customs/import duties:** `[CUSTOMS/IMPORT DUTIES RULE]` must match destination support and checkout disclosure.
- **Address/cancellation cutoff:** `[ADDRESS CHANGE CUTOFF/PROCESS]` must match Printful/order-state implementation.
- **Store support:** `[STORE/ORDER SUPPORT ROUTE]` must be replaced with the deployed order-support route; public `/contact` is expressly not Store support.
- **Cookie controls/analytics:** `[COOKIE PREFERENCE CONTROL LOCATION]` and `[ANALYTICS CONFIGURATION — IF ENABLED]` require live configuration verification. No advertising-cookie program was invented.
- **Accessibility limitations:** `[VERIFIED ACCESSIBILITY LIMITATIONS]` requires an actual prepublication accessibility review. No full-WCAG claim was made.
- **Monetized streaming:** `[MONETIZED VIDEO/STREAMING PERMISSION]` requires a specific owner-approved commercial-use rule. Default fan permission remains noncommercial.
- **DMCA:** `[DMCA AGENT — IF REGISTERED]` must not be replaced unless agent registration and publication requirements are actually satisfied.
- **Proposed effective date:** `[PROPOSED EFFECTIVE DATE]` appears in all public documents and must be set only when publication timing is authorized.

## 5. Externally researched claims

Research was limited to current provider facts needed to avoid false statements. Public legal pages do not include a research bibliography; this report records the verification sources.

### OpenAI — official sources only

1. **OpenAI API data controls** — OpenAI states that, by default, API data is not used to train or improve OpenAI models unless the API customer explicitly opts in. It also describes abuse-monitoring logs, default retention up to 30 days subject to exceptions, and feature-specific application state. Source checked 2026-08-11: https://developers.openai.com/api/docs/guides/your-data
2. **Enterprise privacy** — OpenAI states that API inputs/outputs may be retained up to 30 days subject to endpoint/feature exceptions and legal requirements; ZDR is an eligible/qualifying control rather than a universal default. Source checked 2026-08-11: https://openai.com/enterprise-privacy/

Drafting consequence: the Privacy Policy and AI Disclosure distinguish Eidolon application non-persistence from OpenAI provider-side handling and explicitly **do not** claim ZDR, Modified Abuse Monitoring, `store: false`, or another unverified project control.

### Stripe — official sources

3. **Refunds** — Stripe documents full and partial refunds and states that refunds generally return to the original payment method. Source checked 2026-08-11: https://docs.stripe.com/refunds
4. **Subscription cancellation** — Stripe documents immediate or period-end subscription cancellation and Stripe-hosted customer-portal management. Source checked 2026-08-11: https://docs.stripe.com/billing/subscriptions/cancel
5. **Customer portal / payment-method management** — Stripe documents customer management of payment details, invoices, and subscriptions. Source checked 2026-08-11: https://docs.stripe.com/customer-management
6. **Receipts** — Stripe documents receipts for successful payments and subscription/invoice payments and refund receipt support depending on configuration. Source checked 2026-08-11: https://docs.stripe.com/receipts

Drafting consequence: Stripe is consistently described as payment/billing/refund infrastructure. Provider capabilities were not converted into promises that a particular portal, receipt email, saved-payment feature, or refund timing is enabled unless the owner rule already required the role.

### Printful — official sources

7. **Return/refund handling** — Printful documents merchant-facing made-to-order and quality-issue rules. Source checked 2026-08-11: https://help.printful.com/hc/en-us/articles/360014006840-What-is-Printful-s-return-and-refund-policy
8. **Fulfillment timing** — Printful publishes estimated fulfillment timing that varies by technique/facility and says delivery/fulfillment timeframes are estimates. Source checked 2026-08-11: https://help.printful.com/hc/en-us/articles/360014007980-How-long-does-fulfillment-take

Drafting consequence: Printful is described only as fulfillment. Printful's merchant-facing numeric windows or buyer-remorse rules were **not** silently imported as Eidolon customer promises. Unresolved customer return/claim windows remain configurable placeholders, with mandatory-law savings clauses.

## 6. Implementation facts to verify before deployment

- Exact formal legal entity and any d/b/a registration used for contracting and receipts.
- Launch jurisdictions and any location-specific consumer/privacy disclosures.
- Effective date and publication/acceptance workflow.
- Governing law, venue, and liability cap after counsel review.
- Live Stripe configuration: subscription price object, recurring interval behavior, webhook/server-authoritative success/refund handling, receipt configuration, customer-portal/payment-method features, tax configuration, and refund flows.
- Calendar-month entitlement implementation: preserved anchor day, clamp to month end, later anchor restoration, and exclusive `memberThrough` boundary for both subscription and support-earned time.
- Donation checkout authentication/eligibility gate; $10 minimum/$100 maximum; exact formula; immutable original grant plus separate refund/revocation events.
- Guardian-consent operational process and evidence schema without ordinary DOB/exact-age collection.
- Live OpenAI endpoint/model/project configuration, including whether any feature stores application state and whether any approved retention control is actually enabled. Do not publish ZDR or `store: false` claims without verification.
- Application logging/observability configuration confirming raw player input and raw AI output are excluded from ordinary logs, analytics, error traces, and support traces; sanitized transient-log target approximately 30 days.
- Live durable-retention schedule for accounts, auth/session/security, progression, payments/refunds, donations, subscriptions, membership ledger, support, privacy/legal, tax/accounting, and audit records.
- Live cookie inventory, consent control location, and whether optional analytics are enabled.
- Live Store support route and order-linking behavior.
- Store product/variant configuration for Posters, Mugs, and Hoodies.
- Order acceptance event, payment-confirmed-before-fulfillment gate, Printful release logic, cancellation/address-change cutoff, return/claim window, lost-package process, customs/duty allocation, shipping disclosures, and destination support.
- Accessibility review identifying actual known limitations and verifying keyboard, focus, reduced motion, contrast, text scaling, captions/transcripts where applicable, and equivalent puzzle presentation.
- Fan-content monetized streaming rule.
- DMCA agent registration before publishing an agent notice.
- `/contact` classifications: General company inquiry; Press and media; Business partnerships and licensing; Accessibility feedback; Privacy and data-rights inquiry; Legal notice; Security report; Historical/cultural correction or sourcing concern. Ensure cultural submissions map to `CULTURAL_RESEARCH`.
- `/account/support` availability for authenticated Player Support and signed-out redirect/sign-in behavior.

## 7. Cross-document consistency check

| Topic | Result |
|---|---|
| Age eligibility | PASS — 18+ standard; 14–17 only with valid guardian permission; under 14 ineligible |
| Guardian permission | PASS — required before participating game experience for 14–17 |
| DOB/exact-age collection | PASS — ordinary signup minimizes to eligibility state/consent evidence |
| Subscription price | PASS — $9.99 |
| Subscription interval | PASS — calendar month, not fixed 30 days |
| Member-month semantics | PASS — preserved anchor, month-end clamp, later restoration, exclusive `memberThrough` |
| Subscription optionality | PASS — exact required promise included |
| Donation amount | PASS — $10.00 minimum / $100.00 maximum per qualifying contribution |
| Donation formula | PASS — exact cumulative floor formula used |
| Donation refund effect | PASS — only unconsumed unsupported entitlement revoked; consumed history retained; separate audit event |
| Beta payment availability | PASS — authenticated eligible beta participants may subscribe/support |
| Invitation purchase prohibition | PASS — payment never buys admission, priority, or fast-track |
| Stripe / Printful roles | PASS — Stripe = payment; Printful = fulfillment only |
| Player Support route | PASS — `/account/support`; signed-out users directed to sign in and return |
| Company Contact route | PASS — `/contact` and explicit warning that it is not Player Support |
| AI conversation retention | PASS — no intentional raw transcript persistence in ordinary Eidolon gameplay/logging; structured state only as needed |
| OpenAI processing wording | PASS — provider-side distinction; no unsupported ZDR/store claim |
| Store refund/cancellation | PASS — request != completed refund; payment and fulfillment outcomes distinct |
| Public spoiler boundary | PASS — only “branching” / “multiple stories” style wording used; no hidden count/topology disclosed |
| Four public promises | PASS — preserved exactly where applicable |

## 8. Exact repeated public promises

```text
A subscription will never be required.
never pay-to-win
never sell you
never waste your time
```

The drafts do not reinterpret these into weaker substitute language. Transaction-specific sections explain their scope without erasing the exact statements.

## 9. Spoiler-boundary confirmation

Confirmed: no hidden number of worlds/stories, world-rotation architecture, hidden faction-specific structure, or secret story topology is disclosed in the public documents. Allowed public descriptors such as **branching** and **multiple stories** are used where helpful.

## 10. Square-language confirmation

Confirmed: no public document describes Square as an active provider. The only reference to that provider name in the package is this audit confirmation.

## 11. Stripe / Printful role confirmation

Confirmed across the package: **Stripe = payment, billing, receipts, saved payment methods where enabled, and refunds. Printful = physical merchandise fulfillment only.** Printful is not described as seller or customer payment processor.

## 12. Owner-rule preservation

Confirmed: the 0.2.0 owner-approved product rules were not silently changed. No unresolved business fact was fabricated. Where a term remains unresolved, the drafts use a narrow placeholder or conditional clause. No document states that owner approval itself authorizes production deployment, publication, legal filing, or an effective date.

```text
LEGAL_TEXT_GENERATION_COMPLETE
```
