# Wireframe Implementation Status Audit

Date: 2026-08-10  
Repository: `/home/bobby/echoes-of-eidolon`  
Controlling registry: `apps/web/src/data/page-manifest.json` plus `apps/web/src/data/page-manifest-v3-amendments.json` (269 base states; 273 mechanically derived active V3 states)
Audited checkout: archival checkpoint `7bf9cc3` plus the current focused remediation commits and Admin Data worktree

## Standard used

A page is **IMPLEMENTED** only when a task-specific UI exists and its primary required read/write workflow is connected to the canonical API or persisted owner. A database model, route heading, static mock, generic authorized card, or preview-only importer does not count as a complete page.

- **IMPLEMENTED** — task-specific UI and primary workflow are wired. This is a code-path assessment, not a claim that every wireframe has completed pixel-level browser acceptance.
- **PARTIAL** — task-specific UI exists, but a material state, action, parameter, or persistence path is missing or broken.
- **PLACEHOLDER** — the registered task is deliberately represented by unavailable/deferred/static content.
- **MISSING** — no task-specific page exists, or routing selects the wrong/generic fallback.

## Totals

| Status | Count |
| --- | ---: |
| IMPLEMENTED | 189 |
| PARTIAL | 33 |
| PLACEHOLDER | 49 |
| MISSING | 2 |
| **Total active V3 states** | **273** |

Therefore **84 of 273 active V3** wireframe pages/states are not fully implemented under this standard. The three superseded Matrix entity states remain listed below for forensic traceability but are excluded from the active count.

## Critical findings

1. **Capability authoring is implemented.** CAP01-CAP05 and DATA030 use the versioned definition/address/event/projection authority; legacy history is migrated only when semantics are deterministically recoverable.
2. **The normal Data admin surface is implemented for every active registered entity.** Its allowlist and field contracts are generated from the canonical entity registry and Prisma schema, with persisted list/search/create/edit/delete behavior.
3. **Every active registered entity import has transaction-backed Apply.** JSON, YAML, Markdown, and HTML parsing feed exact-field validation; existing identities are idempotent only when canonical values match.
4. **Player runtime pages remain incomplete.** Maps and globes now expose the authorized physical Atlas catalog while keeping discovery/history fail-closed; Knowledge, Tomes, city/sky maps, Companions, progress, achievements, and support still lack canonical player-facing owners.
5. **Commerce is incomplete.** Catalog read and Stripe checkout initiation exist; cart state, checkout result resolution, return submission, subscriptions, admin item editing, and support are not complete.
6. **Campaign world planners and V3 Book Groupings are implemented.** Campaign placements keep explicit Book membership; grouping values keep their separate explicit range-set authority; custom column preferences change presentation only.
7. **No exhaustive visual acceptance exists for all 273 active V3 states.** Existing E2E coverage is representative, so IMPLEMENTED means the task code path and primary behavior are present—not that every page has passed a one-to-one rendered comparison against its wireframe.

## Explicit page-by-page inventory

| # | Screen ID | Wireframe page/state | Route/state | Current state | Evidence-based assessment |
| ---: | --- | --- | --- | --- | --- |
| 1 | `PUB001` | Home | `/` | **IMPLEMENTED** | Dedicated guest home with managed media and the nine-feature carousel. |
| 2 | `PUB_HOME_ADMIN` | Home | `/` | **IMPLEMENTED** | Signed-in home resolves the persisted account role and exposes the Administration entry. |
| 3 | `PUB_HOME_MEMBER` | Home | `/` | **IMPLEMENTED** | Signed-in home resolves the persisted member role; beta and membership remain separate. |
| 4 | `PUB002` | Features | `/features` | **IMPLEMENTED** | Dedicated feature index for all nine reviewed feature pages. |
| 5 | `FEATURE_01` | A Living World | `/features/a-living-world` | **IMPLEMENTED** | Dedicated feature detail with managed media and reviewed player-facing content. |
| 6 | `FEATURE_02` | Forge Your Path | `/features/forge-your-path` | **IMPLEMENTED** | Dedicated feature detail with managed media and reviewed player-facing content. |
| 7 | `FEATURE_03` | Real Challenges | `/features/real-challenges` | **IMPLEMENTED** | Dedicated feature detail with managed media and reviewed player-facing content. |
| 8 | `FEATURE_04` | Leave Your Mark | `/features/leave-your-mark` | **IMPLEMENTED** | Dedicated feature detail with managed media and reviewed player-facing content. |
| 9 | `FEATURE_05` | The Power of Three | `/features/the-power-of-three` | **IMPLEMENTED** | Dedicated feature detail with managed media and reviewed player-facing content. |
| 10 | `FEATURE_06` | Truth Still Matters | `/features/truth-still-matters` | **IMPLEMENTED** | Dedicated feature detail with managed media and reviewed player-facing content. |
| 11 | `FEATURE_08` | Speak or Type Freely | `/features/speak-or-type-freely` | **IMPLEMENTED** | Dedicated feature detail with managed media and reviewed player-facing content. |
| 12 | `FEATURE_09` | A Unique and Powerful Story | `/features/a-unique-and-powerful-story` | **IMPLEMENTED** | Dedicated feature detail with managed media and reviewed player-facing content. |
| 13 | `FEATURE_07` | Real Life Comes First | `/features/real-life-comes-first` | **IMPLEMENTED** | Dedicated feature detail with managed media and reviewed player-facing content. |
| 14 | `PUB003` | Gameplay | `/gameplay` | **IMPLEMENTED** | Dedicated gameplay page with media and the reviewed gameplay sequence. |
| 15 | `PUB017` | Release Notes | `/status/releases` | **IMPLEMENTED** | Reads and renders published release records from `/api/releases`. |
| 16 | `PUB018` | Release Note Detail | `/status/releases/:version` | **PARTIAL** | Detail layout exists, but it always selects the first release and does not resolve the `:version` parameter. |
| 17 | `PUB015` | Contact Us | `/contact` | **IMPLEMENTED** | Contact form validates, persists, and attempts configured delivery through `/api/contact`. |
| 18 | `PUB016` | Game & Server Status | `/status` | **PARTIAL** | Live health endpoint is rendered; maintenance, incident, and current-release sources are explicitly unconfigured. |
| 19 | `PUB009` | Donation Checkout | `/donate/checkout` | **IMPLEMENTED** | Eligible donation amount starts server-owned Stripe Checkout; grant waits for signed webhook persistence. |
| 20 | `PUB019` | Legal Index | `/legal` | **IMPLEMENTED** | Dedicated legal-document index and navigation. |
| 21 | `LEGAL01` | Legal Document - Terms | `/legal/terms` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 22 | `LEGAL02` | Legal Document - Privacy | `/legal/privacy` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 23 | `LEGAL03` | Legal Document - Cookies | `/legal/cookies` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 24 | `LEGAL04` | Legal Document - Accessibility | `/legal/accessibility` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 25 | `LEGAL05` | Legal Document - Conduct | `/legal/conduct` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 26 | `LEGAL06` | Legal Document - Beta | `/legal/beta` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 27 | `LEGAL07` | Legal Document - Membership | `/legal/membership` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 28 | `LEGAL08` | Legal Document - Donations | `/legal/donations` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 29 | `LEGAL09` | Legal Document - Store | `/legal/store` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 30 | `LEGAL10` | Legal Document - Shipping | `/legal/shipping` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 31 | `LEGAL11` | Legal Document - Returns | `/legal/returns` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 32 | `LEGAL12` | Legal Document - Ip Fan Content | `/legal/ip-fan-content` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 33 | `LEGAL13` | Legal Document - Ai Player Content | `/legal/ai-player-content` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 34 | `LEGAL14` | Legal Document - Cultural Use & Research Corrections | `/legal/cultural-use-research-corrections` | **PLACEHOLDER** | Task shell and navigation exist, but the page contains only an owner-copy placeholder; approved legal prose is absent. |
| 35 | `PUB020` | Donate - Guest / Information Only | `/donate` | **IMPLEMENTED** | Guest donation information state is role-aware and does not expose checkout. |
| 36 | `PUB021` | Donate - Eligible Participant | `/donate` | **IMPLEMENTED** | Eligible participant state checks player access before exposing donation checkout. |
| 37 | `AUT008` | Session Expired | `/auth/session-expired` | **IMPLEMENTED** | Session-expired state links back to sign-in without inventing session data. |
| 38 | `PUB023` | Request an Invite - Public Entry | `/request-invite` | **IMPLEMENTED** | Public invitation request includes required consent and calls the persisted request endpoint. |
| 39 | `AUTH01` | Sign In | `/auth/sign-in` | **IMPLEMENTED** | Email/password sign-in calls Better Auth and preserves a bounded return path. |
| 40 | `AUTH02` | Sign Out | `/auth/sign-out` | **IMPLEMENTED** | Sign-out action calls Better Auth. |
| 41 | `AUTH03` | Sign Up | `/auth/sign-up` | **PARTIAL** | Adult sign-up persists through Better Auth; the reviewed minor/guardian-consent path is disabled and owner-deferred. |
| 42 | `AUTH04` | Forgot Password | `/auth/forgot-password` | **IMPLEMENTED** | Password-reset OTP request is wired. |
| 43 | `AUTH05` | Reset Password | `/auth/reset-password` | **IMPLEMENTED** | OTP plus new-password reset is wired. |
| 44 | `AUTH06` | Verify Email - Modal | `Modal in /auth/sign-up` | **IMPLEMENTED** | Email-verification modal supports verify and resend. |
| 45 | `AUTH07` | Redeem Invitation | `/auth/redeem-invitation` | **IMPLEMENTED** | Invitation redemption calls the persisted invitation endpoint. |
| 46 | `AUTH08` | Two-Factor Challenge | `/auth/two-factor` | **IMPLEMENTED** | Two-factor OTP send and verify are wired. |
| 47 | `AUTH09` | Passkeys | `/auth/passkeys` | **IMPLEMENTED** | Passkey sign-in is wired. |
| 48 | `ACC001` | Account - Profile | `/account/profile` | **IMPLEMENTED** | Profile/display-name and verified email-change workflow call Better Auth; username remains immutable. |
| 49 | `ACC002` | Change Email - Modal | `Modal in /account/profile` | **IMPLEMENTED** | Profile/display-name and verified email-change workflow call Better Auth; username remains immutable. |
| 50 | `ACC003` | Change Email - Verify Modal | `Modal in /account/profile` | **IMPLEMENTED** | Profile/display-name and verified email-change workflow call Better Auth; username remains immutable. |
| 51 | `ACC004` | Authorized Sessions | `/account/profile` | **IMPLEMENTED** | Lists persisted sessions and supports revoking one or all other sessions. |
| 52 | `ACC005` | Subscription - Not Subscribed | `/account/subscription` | **PARTIAL** | Persisted membership state is readable, but `Start membership` is disabled and no Stripe subscription operation exists. |
| 53 | `ACC006` | Subscription - Payment Accepted | `/account/subscription` | **PLACEHOLDER** | Only the membership ledger renders; the requested provider result/cancel state is replaced by an owner-deferred card. |
| 54 | `ACC007` | Subscription - Card Declined | `/account/subscription` | **PLACEHOLDER** | Only the membership ledger renders; the requested provider result/cancel state is replaced by an owner-deferred card. |
| 55 | `ACC008` | Subscription - Active | `/account/subscription` | **IMPLEMENTED** | Renders active persisted membership entitlement and active perks. |
| 56 | `ACC009` | Subscription - Cancel Confirmation | `/account/subscription` | **PLACEHOLDER** | Only the membership ledger renders; the requested provider result/cancel state is replaced by an owner-deferred card. |
| 57 | `ACC010` | Subscription - History | `/account/subscription` | **IMPLEMENTED** | Renders persisted membership-grant history. |
| 58 | `ACC011` | Orders | `/account/orders` | **IMPLEMENTED** | Reads the signed-in account's persisted merchandise orders. |
| 59 | `ACC012` | Order Detail | `/account/orders/:orderid` | **IMPLEMENTED** | Reads one owned order, line items, payment, fulfillment, refunds, and return eligibility. |
| 60 | `ACC013` | Return Request | `/account/orders/:orderid/return` | **PLACEHOLDER** | Eligibility can be displayed, but return submission is disabled; no return/refund mutation exists. |
| 61 | `ACC014` | Settings - Standalone | `/settings` | **IMPLEMENTED** | Shared settings panel reads and writes the same persisted account settings owner. |
| 62 | `ACC015` | Settings - Account Tab Mirror | `/account/settings` | **IMPLEMENTED** | Shared settings panel reads and writes the same persisted account settings owner. |
| 63 | `ACC016` | Progress | `/account/progress` | **PLACEHOLDER** | Owner-deferred card only; campaign progress and countdown projection are absent. |
| 64 | `ACC017` | Progress - No Current Countdown | `/account/progress` | **PLACEHOLDER** | Owner-deferred card only; campaign progress and countdown projection are absent. |
| 65 | `ACC018` | Achievements | `/account/achievements` | **PLACEHOLDER** | Definitions exist, but player award state, thresholds, and disclosure are absent. |
| 66 | `ACC019` | Help Tickets | `/account/support` | **PLACEHOLDER** | Owner-deferred card only; support ticket storage, status, replies, and delivery are absent. |
| 67 | `ACC020` | Create Help Ticket | `/account/support/new` | **PLACEHOLDER** | Owner-deferred card only; support ticket storage, status, replies, and delivery are absent. |
| 68 | `ACC021` | Help Ticket Detail | `/account/support/:ticketid` | **PLACEHOLDER** | Owner-deferred card only; support ticket storage, status, replies, and delivery are absent. |
| 69 | `ACC022` | Request Invite | `/account/invitations/request` | **PARTIAL** | Form calls the invitation endpoint but omits the schema-required `consent: true`, so submission fails validation. |
| 70 | `ACC023` | Invite Request - Pending | `/account/invitations/request` | **PARTIAL** | Uses the same broken request form as ACC022; direct entry does not render the requested pending state. |
| 71 | `ACC030` | Authenticated Beta Landing | `state-only` | **IMPLEMENTED** | Reads player access and renders the authenticated beta landing with bounded game entry. |
| 72 | `STORE01` | Store Landing | `/store` | **IMPLEMENTED** | Reads server-configured catalog and variants; honest unavailable state is shown when configuration is absent. |
| 73 | `STORE02` | Store Category - Posters | `/store/categories/posters` | **IMPLEMENTED** | Reads server-configured catalog and variants; honest unavailable state is shown when configuration is absent. |
| 74 | `STORE03` | Store Category - Mugs | `/store/categories/mugs` | **IMPLEMENTED** | Reads server-configured catalog and variants; honest unavailable state is shown when configuration is absent. |
| 75 | `STORE04` | Store Category - Hoodies | `/store/categories/hoodies` | **IMPLEMENTED** | Reads server-configured catalog and variants; honest unavailable state is shown when configuration is absent. |
| 76 | `STORE05` | Product Detail | `/store/products/:slug` | **IMPLEMENTED** | Reads one configured product and its variants, with server-owned price and availability. |
| 77 | `STORE06` | Cart | `/store/cart` | **PLACEHOLDER** | Informational card only; there is no cart owner, line mutation, quantity update, or persisted cart. |
| 78 | `STORE07` | Checkout - Contact & Delivery | `/store/checkout` | **PARTIAL** | Can start Stripe Checkout for one selected variant, but the reviewed cart/contact/delivery composition is not implemented. |
| 79 | `ADM002` | Server Operations | `/admin/server` | **PARTIAL** | Routes to bounded health/build/release/document operations; the reviewed server-operations controls are not implemented. |
| 80 | `STORE09` | Checkout - Card Declined | `/store/checkout/declined` | **PLACEHOLDER** | Static warning only; route does not resolve a signed Stripe result or persisted order. |
| 81 | `STORE10` | Checkout - Approved | `/store/checkout/approved` | **PLACEHOLDER** | Static warning only; route does not resolve a signed Stripe result or persisted order. |
| 82 | `STORE11` | Guest Order Status | `/store/orders/:token` | **PLACEHOLDER** | Explicit unavailable card; guest order tokens/status are not implemented. |
| 83 | `STORE12` | Guest Order Lookup | `/store/order-lookup` | **PLACEHOLDER** | Sign-in redirect only; there is no lookup form or order-resolution workflow. |
| 84 | `STORE13` | Store Order Support | `/store/support` | **MISSING** | Dispatch checks nonexistent `STORE08`; this registered page falls to `Store screen unavailable`. |
| 85 | `ADM001` | Admin Dashboard | `/admin` | **MISSING** | Falls through to the generic authorized-admin card; no dashboard metrics or task UI. |
| 86 | `ADM002` | Accounts | `/admin/access` | **IMPLEMENTED** | Server-backed account search/list with links to account detail. |
| 87 | `ADM003` | Roles | `/admin/access/roles` | **PARTIAL** | Displays the access/capability policy table, but provides no role-management workflow. |
| 88 | `ADM004` | Invite/Access Approval Queue | `/admin/access/approvals` | **IMPLEMENTED** | Server-backed invitation approval/rejection queue with expiry and email issuance. |
| 89 | `ADM005` | Account Detail | `/admin/access/:id` | **IMPLEMENTED** | Server-backed account detail; OWNER can persist role changes. |
| 90 | `ADM006` | Invitation Codes | `/admin/access/invites` | **IMPLEMENTED** | Lists issued invitation lifecycle without exposing bearer codes. |
| 91 | `ADM007` | Donation Perks | `/admin/perks` | **IMPLEMENTED** | Lists persisted donation perks. |
| 92 | `ADM008` | Perk Detail/Edit | `/admin/perks/:id` | **IMPLEMENTED** | Reads and persists perk name, description, and active status. |
| 93 | `ADM010` | Store Management | `/admin/store` | **PARTIAL** | Reads configured products and variants, but offers no product/category create or edit mutation. |
| 94 | `ADM011` | Store Categories | `/admin/store/categories` | **PLACEHOLDER** | Explicit unavailable card; category management is absent. |
| 95 | `ADM012` | Store Items | `/admin/store/items` | **PARTIAL** | Reads configured products and variants, but offers no product/category create or edit mutation. |
| 96 | `ADM013` | Store Item Editor | `/admin/store/items/:id` | **PLACEHOLDER** | Explicit unavailable card; item editor and persistence are absent. |
| 97 | `ADM014` | Order Management | `/admin/orders` | **PARTIAL** | Reads merchandise orders and provider state, but offers no admin order actions. |
| 98 | `ADM015` | Order Management - Merchandise | `/admin/orders?tab=merchandise` | **PARTIAL** | Reads merchandise orders and provider state, but offers no admin order actions. |
| 99 | `ADM016` | Order Management - Subscriptions | `/admin/orders?tab=subscriptions` | **PLACEHOLDER** | Explicit unavailable card; the requested order subtype/detail workflow is absent. |
| 100 | `ADM017` | Order Management - Donations | `/admin/orders?tab=donations` | **PLACEHOLDER** | Explicit unavailable card; the requested order subtype/detail workflow is absent. |
| 101 | `ADM018` | Order Detail/Admin Actions | `/admin/orders/:id` | **PLACEHOLDER** | Explicit unavailable card; the requested order subtype/detail workflow is absent. |
| 102 | `ADM020` | Bulk Operations & External API | `/admin/data/bulk-operations` | **IMPLEMENTED** | External data authority is OFF by default; an authorized administrator can generate one 30-minute hash-stored key, copy it once, inspect expiry, and revoke it. |
| 103 | `ADM021` | Bulk API - Enabled Key | `/admin/data/bulk-operations` | **IMPLEMENTED** | External data authority is OFF by default; an authorized administrator can generate one 30-minute hash-stored key, copy it once, inspect expiry, and revoke it. |
| 104 | `ADM022` | Bulk Operations - Audit / Recent Activity | `/admin/data/bulk-operations` | **IMPLEMENTED** | Reads append-only BulkOperationAudit records with actor/session attribution, result, count, time, and bounded detail. |
| 105 | `DATA_ANTAGONIST_TABLE` | Antagonist Records | `/admin/data/antagonist` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 106 | `ADM031` | Asset Manager - Audio | `/admin/assets/audio` | **PARTIAL** | Reads persisted audio asset metadata; upload, replace, purpose-link, and edit actions are absent. |
| 107 | `ADM032` | Asset Manager - Video | `/admin/assets/video` | **PARTIAL** | Reads persisted video asset metadata; upload, replace, purpose-link, and edit actions are absent. |
| 108 | `ADM033` | Prompt Manager | `/admin/prompts` | **PARTIAL** | Reads prompt/version/result records, but cannot create prompts, append versions, or associate results. |
| 109 | `ADM034` | Prompt Manager - Outstanding Only | `/admin/prompts` | **PARTIAL** | Filters outstanding prompts, but provides no completion or result-association action. |
| 110 | `DATA000` | Data - Object Types | `/admin/data` | **IMPLEMENTED** | Registry-derived object-type index links every active canonical entity to persisted records and its validated import workflow. |
| 111 | `DATA001` | Data - Protagonist | `/admin/data/protagonist` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 112 | `DATA002` | Data - Culture | `/admin/data/culture` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 113 | `DATA003` | Data - Character | `/admin/data/character` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 114 | `DATA004` | Data - Witness | `/admin/data/witness` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 115 | `DATA005` | Data - Architect | `/admin/data/architect` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 116 | `DATA006` | Data - Antagonist | `/admin/data/antagonist` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 117 | `DATA007` | Data - Species | `/admin/data/species` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 118 | `DATA008` | Data - PersonalityExpression | `/admin/data/personality-expression` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 119 | `DATA009` | Data - TimelineEvent | `/admin/data/timeline-event` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 120 | `DATA010` | Data - Interlude | `/admin/data/interlude` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 121 | `DATA011` | Data - Pillar | `/admin/data/pillar` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 122 | `DATA012` | Data - Ark | `/admin/data/ark` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 123 | `DATA013` | Data - Constellation | `/admin/data/constellation` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 124 | `DATA014` | Data - Reward | `/admin/data/reward` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 125 | `DATA015` | Data - Soul | `/admin/data/soul` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 126 | `DATA016` | Data - PointOfInterest | `/admin/data/point-of-interest` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 127 | `DATA017` | Data - Site | `/admin/data/site` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 128 | `DATA018` | Data - Settlement | `/admin/data/settlement` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 129 | `DATA019` | Data - Breed | `/admin/data/breed` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 130 | `DATA020` | Data - Tome | `/admin/data/tome` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 131 | `DATA021` | Data - Lesson | `/admin/data/lesson` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 132 | `DATA022` | Data - Companion | `/admin/data/companion` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 133 | `DATA100` | Data - Research | `/admin/data/research` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 134 | `DATA101` | Data - MLA Sources | `/admin/data/sources` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 135 | `DATA102` | Data - Citations | `/admin/data/citations` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 136 | `PZ001` | Puzzle Designer - Blueprints | `/admin/puzzles` | **IMPLEMENTED** | Reads canonical Puzzle Blueprint roots, immutable versions, and governed hint metadata. |
| 137 | `PZ002` | Puzzle Blueprint Editor | `/admin/puzzles/:id` | **PLACEHOLDER** | Explicit warning only; editor writes, generation, preview, and answer validation are unavailable. |
| 138 | `PZ003` | Puzzle Test/Preview | `/admin/puzzles/:id/test` | **PLACEHOLDER** | Explicit warning only; editor writes, generation, preview, and answer validation are unavailable. |
| 139 | `DATA_ANTAGONIST_NEW` | Create Antagonist | `/admin/data/antagonist/new` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 140 | `AT002` | Points of Interest - 2D Map | `/admin/atlas/poi` | **IMPLEMENTED** | Reads the canonical R08 POI catalog with selectable 2D/3D visualization and record detail. |
| 141 | `AT003` | Points of Interest - 3D Globe | `/admin/atlas/poi` | **IMPLEMENTED** | Reads the canonical R08 POI catalog with selectable 2D/3D visualization and record detail. |
| 142 | `AT004` | Sites | `/admin/atlas/sites` | **IMPLEMENTED** | Reads canonical settlement-candidate Site records. |
| 143 | `AT005` | Settlements | `/admin/atlas/settlements` | **IMPLEMENTED** | Reads persisted Settlements by explicitly selected world and links to migration. |
| 144 | `DATA_CHARACTER_NEW` | Create Character | `/admin/data/character/new` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 145 | `CITY01` | City Builder - Cities | `/admin/cities` | **IMPLEMENTED** | Lists persisted City projects and creates the single project for a canonically named SettlementWorld without inventing a City name. |
| 146 | `CITY02` | City Builder - Parcels & Street Graph | `/admin/cities/:id/streets` | **IMPLEMENTED** | Reads and transactionally upserts Parcel and Street geometry under one City owner while advancing the shared geometry version. |
| 147 | `CITY03` | City Builder - Buildings & Exteriors | `/admin/cities/:id/exteriors` | **PARTIAL** | Reads/writes Building geometry and validates same-City Parcel membership; frontage, entrances, exterior views, and multi-parcel occupancy have no canonical owner. |
| 148 | `CITY04` | City Builder - Interiors | `/admin/cities/:id/interiors` | **PLACEHOLDER** | Explicitly unavailable because the supplied domain has no Interior, Room, Passage, floor, or reachability owner; Building geometry is not repurposed. |
| 149 | `CITY05` | City Builder - Preview / District Overlays | `/admin/cities/:id/preview` | **PARTIAL** | Reports the persisted structural geometry/version; no spatial-render or district-overlay contract exists, so the summary is not mislabeled as a render. |
| 150 | `CAM001` | Campaign Builder - Landing | `/admin/campaign` | **IMPLEMENTED** | Dedicated Campaign Manager landing with explicit Concord/Ruin/Schism selection. |
| 151 | `CAM002` | Campaign Planner | `/admin/campaign/planner` | **IMPLEMENTED** | Dispatches the Concord planner with persisted explicit Book membership, inclusive row spans, collision lanes, typed pools, and filters. |
| 152 | `CAM003` | Campaign Planner - Witness Drop | `/admin/campaign/planner` | **IMPLEMENTED** | Dispatches the requested reviewed planner state while preserving atomic linked placement validation and zero partial mutations. |
| 153 | `CAM004` | Campaign Planner - Invalid Architect Drop | `/admin/campaign/planner` | **IMPLEMENTED** | Dispatches the requested reviewed planner state while preserving atomic linked placement validation and zero partial mutations. |
| 154 | `CAM005` | Campaign Planner - Reward Binding | `/admin/campaign/planner` | **IMPLEMENTED** | Dispatches the requested reviewed planner state while preserving atomic linked placement validation and zero partial mutations. |
| 155 | `OPS001` | Operations | `/admin/operations` | **IMPLEMENTED** | Server-owned health/build links and persisted document-draft builder are wired; arbitrary shell execution is excluded. |
| 156 | `OPS002` | Release Management | `/admin/operations/releases` | **PARTIAL** | Release drafts can be persisted, but the existing publish endpoint is not exposed and deployment remains separate. |
| 157 | `DATA023` | Data - SpeciesGroup | `/admin/data/species-group` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 158 | `DATA024` | Data - InterludeSubstitution | `/admin/data/interlude-substitution` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 159 | `DATA025` | Data - Definition | `/admin/data/definition` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 160 | `DATA026` | Data - KnowledgeBaseItem | `/admin/data/knowledge-base-item` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 161 | `DATA027` | Data - Matrix | `/admin/data/matrix` | **SUPERSEDED** | Removed by the V3 Atlas correction because Matrix was an invented domain entity. Legitimate descriptive uses of the word matrix remain. |
| 162 | `DATA028` | Data - Layette | `/admin/data/layette` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 163 | `DATA029` | Data - Transition | `/admin/data/transition` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 164 | `DATA030` | Data - CapabilityDefinition | `/admin/data/capability-definition` | **IMPLEMENTED** | Dedicated versioned Capability registry/editor, condition builder, scoring policy view, and event/projection inspector use persisted authority. |
| 165 | `DATA031` | Data - AchievementDefinition | `/admin/data/achievement-definition` | **IMPLEMENTED** | Schema-derived persisted record administration supports list, search, create, edit, delete, and validated import for this canonical entity. |
| 166 | `GAME001` | Game - Effective Viewport | `state-only` | **IMPLEMENTED** | Authenticated player-safe runtime reads location/turns and persists freeform player input. |
| 167 | `GAME002` | Knowledge Base - Graph | `/game/knowledge` | **PLACEHOLDER** | Owner-deferred Knowledge shell only; discovery, graph links, detail content, and timeline projection are absent. |
| 168 | `GAME003` | Knowledge Base - Detail Card | `state-only` | **PLACEHOLDER** | Owner-deferred Knowledge shell only; discovery, graph links, detail content, and timeline projection are absent. |
| 169 | `GAME004` | Bookshelf / Tome Reader | `state-only` | **PLACEHOLDER** | Empty bookshelf/reader shell; discovered Tome identity, content, and pagination are absent. |
| 170 | `GAME005` | Maps - 3D Globe | `state-only` | **PARTIAL** | Renders the authorized physical Atlas catalog on the globe; discovery, routes, politics, and historical visibility remain fail-closed. |
| 171 | `GAME006` | Continent Map | `state-only` | **PARTIAL** | Renders the authorized physical Atlas catalog; no authoritative player-known regional filter or discovery projection exists. |
| 172 | `GAME007` | City Map | `state-only` | **PLACEHOLDER** | Empty player map/globe shell; player-safe geography, overlays, discovery, routes, and timeline data are absent. |
| 173 | `GAME008` | Game - Nearby Characters | `state-only` | **PARTIAL** | Runtime location/turns work, but nearby-character and exit projections remain empty and have no disclosed row contract. |
| 174 | `GAME009` | Game - Multiple Exits | `state-only` | **PARTIAL** | Runtime location/turns work, but nearby-character and exit projections remain empty and have no disclosed row contract. |
| 175 | `GAME010` | Game - Single Exit | `state-only` | **PARTIAL** | Runtime location/turns work, but nearby-character and exit projections remain empty and have no disclosed row contract. |
| 176 | `GAME011` | Witness Trial Warning | `/game/witness-trial` | **IMPLEMENTED** | Loads assigned Puzzle Blueprint, persists explicit acceptance, runs the immutable timer, and renders ordered hints. |
| 177 | `GAME012` | Companions | `state-only` | **PLACEHOLDER** | Static empty Companion shell; identities, health, relationships, and Heirloom details are absent. |
| 178 | `GAME013` | Constellations / Sky Viewer | `state-only` | **PLACEHOLDER** | Empty player map/globe shell; player-safe geography, overlays, discovery, routes, and timeline data are absent. |
| 179 | `GAME014` | Calendar | `state-only` | **IMPLEMENTED** | Reads persisted CalendarOrdinal rows with governed month/day geometry. |
| 180 | `GAME015` | Shared Settings - Game Overlay | `Modal in /game` | **IMPLEMENTED** | Shared persisted settings panel is rendered as a game overlay over the runtime viewport. |
| 181 | `GAME016` | Knowledge Base - Timeline Viewer | `state-only` | **PLACEHOLDER** | Owner-deferred Knowledge shell only; discovery, graph links, detail content, and timeline projection are absent. |
| 182 | `TOOL001` | Control Gallery - Hardened Lookups | `/review/controls/lookups` | **IMPLEMENTED** | Dedicated interactive control-gallery state for the reviewed control family. |
| 183 | `TOOL002` | Control Gallery - Free Solo | `state-only` | **IMPLEMENTED** | Dedicated interactive control-gallery state for the reviewed control family. |
| 184 | `TOOL003` | Control Gallery - Enum Selects | `state-only` | **IMPLEMENTED** | Dedicated interactive control-gallery state for the reviewed control family. |
| 185 | `TOOL004` | Control Gallery - Numeric | `state-only` | **IMPLEMENTED** | Dedicated interactive control-gallery state for the reviewed control family. |
| 186 | `TOOL005` | Wireframe Builder - Component Composer | `state-only` | **IMPLEMENTED** | Interactive component composer for reviewed shared primitives. |
| 187 | `TOOL006` | Public Navigation - Guest/User/Member States | `/review/navigation-states` | **IMPLEMENTED** | Dedicated guest/user/member/admin/owner navigation-capability comparison. |
| 188 | `DATA_LEGENDARYREWARD_EDIT` | Edit LegendaryReward | `/admin/data/legendaryreward/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 189 | `DATA_LESSON_EDIT` | Edit Lesson | `/admin/data/lesson/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 190 | `DATA_MATRIX_EDIT` | Edit Matrix | `/admin/data/matrix/sample-record` | **SUPERSEDED** | Removed by the V3 Atlas correction because Matrix was an invented domain entity. Legitimate descriptive uses of the word matrix remain. |
| 191 | `DATA_PERSONALITYEXPRESSION_EDIT` | Edit PersonalityExpression | `/admin/data/personalityexpression/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 192 | `DATA_PILLAR_EDIT` | Edit Pillar | `/admin/data/pillar/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 193 | `DATA_POINTOFINTEREST_EDIT` | Edit PointOfInterest | `/admin/data/pointofinterest/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 194 | `DATA_PROTAGONIST_EDIT` | Edit Protagonist | `/admin/data/protagonist/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 195 | `DATA_RESEARCH_EDIT` | Edit Research | `/admin/data/research/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 196 | `DATA_SETTLEMENT_EDIT` | Edit Settlement | `/admin/data/settlement/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 197 | `DATA_SITE_EDIT` | Edit Site | `/admin/data/site/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 198 | `DATA_SOUL_EDIT` | Edit Soul | `/admin/data/soul/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 199 | `DATA_SOURCE_EDIT` | Edit Source | `/admin/data/source/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 200 | `DATA_SPECIESGROUP_EDIT` | Edit SpeciesGroup | `/admin/data/speciesgroup/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 201 | `DATA_SPECIES_EDIT` | Edit Species | `/admin/data/species/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 202 | `DATA_TIMELINEEVENT_EDIT` | Edit TimelineEvent | `/admin/data/timelineevent/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 203 | `DATA_TOME_EDIT` | Edit Tome | `/admin/data/tome/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 204 | `DATA_TRANSITION_EDIT` | Edit Transition | `/admin/data/transition/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 205 | `DATA_WITNESS_EDIT` | Edit Witness | `/admin/data/witness/sample-record` | **IMPLEMENTED** | Dynamic record identity routing loads persisted data and exposes schema-derived validation and save behavior; the reviewed sample identity resolves without becoming canonical data. |
| 206 | `DATA_ACHIEVEMENTDEFINITION_IMPORT` | Bulk Import AchievementDefinition | `/admin/data/achievementdefinition/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 207 | `DATA_ANTAGONIST_IMPORT` | Bulk Import Antagonist | `/admin/data/antagonist/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 208 | `DATA_ARCHITECT_IMPORT` | Bulk Import Architect | `/admin/data/architect/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 209 | `DATA_ARK_IMPORT` | Bulk Import Ark | `/admin/data/ark/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 210 | `DATA_BREED_IMPORT` | Bulk Import Breed | `/admin/data/breed/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 211 | `DATA_CAPABILITYDEFINITION_IMPORT` | Bulk Import CapabilityDefinition | `/admin/data/capabilitydefinition/import` | **IMPLEMENTED** | Structured preview applies through the specialized versioned Capability definition importer with transaction-backed validation and canonical-drift refusal. |
| 212 | `DATA_CHARACTER_IMPORT` | Bulk Import Character | `/admin/data/character/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 213 | `DATA_CITATION_IMPORT` | Bulk Import Citation | `/admin/data/citation/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 214 | `DATA_COMPANION_IMPORT` | Bulk Import Companion | `/admin/data/companion/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 215 | `DATA_CONSTELLATION_IMPORT` | Bulk Import Constellation | `/admin/data/constellation/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 216 | `DATA_CULTURE_IMPORT` | Bulk Import Culture | `/admin/data/culture/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 217 | `DATA_DEFINITION_IMPORT` | Bulk Import Definition | `/admin/data/definition/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 218 | `DATA_INTERLUDESUBSTITUTION_IMPORT` | Bulk Import InterludeSubstitution | `/admin/data/interludesubstitution/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 219 | `DATA_INTERLUDE_IMPORT` | Bulk Import Interlude | `/admin/data/interlude/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 220 | `DATA_KNOWLEDGEBASEITEM_IMPORT` | Bulk Import KnowledgeBaseItem | `/admin/data/knowledgebaseitem/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 221 | `DATA_LAYETTE_IMPORT` | Bulk Import Layette | `/admin/data/layette/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 222 | `DATA_LEGENDARYREWARD_IMPORT` | Bulk Import LegendaryReward | `/admin/data/legendaryreward/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 223 | `DATA_LESSON_IMPORT` | Bulk Import Lesson | `/admin/data/lesson/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 224 | `DATA_MATRIX_IMPORT` | Bulk Import Matrix | `/admin/data/matrix/import` | **SUPERSEDED** | Removed by the V3 Atlas correction because Matrix was an invented domain entity. Legitimate descriptive uses of the word matrix remain. |
| 225 | `DATA_PERSONALITYEXPRESSION_IMPORT` | Bulk Import PersonalityExpression | `/admin/data/personalityexpression/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 226 | `DATA_PILLAR_IMPORT` | Bulk Import Pillar | `/admin/data/pillar/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 227 | `DATA_POINTOFINTEREST_IMPORT` | Bulk Import PointOfInterest | `/admin/data/pointofinterest/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 228 | `DATA_PROTAGONIST_IMPORT` | Bulk Import Protagonist | `/admin/data/protagonist/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 229 | `DATA_RESEARCH_IMPORT` | Bulk Import Research | `/admin/data/research/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 230 | `DATA_SETTLEMENT_IMPORT` | Bulk Import Settlement | `/admin/data/settlement/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 231 | `DATA_SITE_IMPORT` | Bulk Import Site | `/admin/data/site/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 232 | `DATA_SOUL_IMPORT` | Bulk Import Soul | `/admin/data/soul/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 233 | `DATA_SOURCE_IMPORT` | Bulk Import Source | `/admin/data/source/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 234 | `DATA_SPECIESGROUP_IMPORT` | Bulk Import SpeciesGroup | `/admin/data/speciesgroup/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 235 | `DATA_SPECIES_IMPORT` | Bulk Import Species | `/admin/data/species/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 236 | `DATA_TIMELINEEVENT_IMPORT` | Bulk Import TimelineEvent | `/admin/data/timelineevent/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 237 | `DATA_TOME_IMPORT` | Bulk Import Tome | `/admin/data/tome/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 238 | `DATA_TRANSITION_IMPORT` | Bulk Import Transition | `/admin/data/transition/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 239 | `DATA_WITNESS_IMPORT` | Bulk Import Witness | `/admin/data/witness/import` | **IMPLEMENTED** | Structured parse/map/validate/preview applies through a transaction-backed typed or schema-derived mutation with idempotency and canonical-drift refusal. |
| 240 | `ADM027` | Puzzle Designer | `/admin/puzzles` | **PARTIAL** | Shows the Blueprint list, but no designer/editor workflow exists. |
| 241 | `ADM028` | Puzzle Blueprints | `/admin/puzzles/blueprints` | **IMPLEMENTED** | Reads canonical Puzzle Blueprint roots and immutable versions. |
| 242 | `ADM029` | Reusable Puzzle Components | `/admin/puzzles/components` | **PLACEHOLDER** | Explicit warning only; reusable component editing, generation, preview, and validation lab are absent. |
| 243 | `ADM030` | Puzzle Test & Validation Lab | `/admin/puzzles/test-lab` | **PLACEHOLDER** | Explicit warning only; reusable component editing, generation, preview, and validation lab are absent. |
| 244 | `ADM031` | Atlas Manager | `/admin/atlas` | **IMPLEMENTED** | Dedicated atlas landing with canonical R08 counts and navigation. |
| 245 | `ADM032` | Points of Interest — View Selector | `/admin/atlas/pois` | **IMPLEMENTED** | Dedicated 2D/3D POI selector backed by the canonical R08 catalog. |
| 246 | `ATLAS_POI_2D` | Points of Interest — 2D View | `/admin/atlas/pois` | **IMPLEMENTED** | Selectable canonical R08 POI visualization with table and detail. |
| 247 | `ATLAS_POI_3D` | Points of Interest — 3D View | `/admin/atlas/pois` | **IMPLEMENTED** | Selectable canonical R08 POI visualization with table and detail. |
| 248 | `ADM033` | Sites | `/admin/atlas/sites` | **IMPLEMENTED** | Reads canonical settlement-candidate Sites. |
| 249 | `AT004_FOUND_CITY` | Found City — SITE-0081 | `/admin/atlas/sites/SITE-0081` | **PLACEHOLDER** | Explicitly unavailable; server services exist, but the exact server-owned naming prompt/response contract is absent. |
| 250 | `ADM034` | Settlements | `/admin/atlas/settlements` | **IMPLEMENTED** | Reads persisted Settlements by selected world. |
| 251 | `AT005_SETTLEMENT_DETAIL` | Migrate — SET-0001 | `/admin/atlas/settlements/SET-0001/migrate` | **IMPLEMENTED** | Reads origin/destination populations and atomically persists same-world Breed migration. |
| 252 | `ADM035` | Campaign Manager | `/admin/campaign` | **IMPLEMENTED** | Dedicated Campaign Manager landing with explicit Concord/Ruin/Schism selection. |
| 253 | `CAMPAIGN_CONCORD` | Main 18-Book Planner — Concord | `/admin/campaign/planner` | **IMPLEMENTED** | Full 18-book planner reads/writes canonical placements; cards use inclusive persisted book membership, collision lanes, and true row spans. |
| 254 | `CAMPAIGN_RUIN` | Main 18-Book Planner — Ruin | `/admin/campaign/planner` | **IMPLEMENTED** | Full 18-book planner reads/writes canonical placements; cards use inclusive persisted book membership, collision lanes, and true row spans. |
| 255 | `CAMPAIGN_SCHISM` | Main 18-Book Planner — Schism | `/admin/campaign/planner` | **IMPLEMENTED** | Full 18-book planner reads/writes canonical placements; cards use inclusive persisted book membership, collision lanes, and true row spans. |
| 256 | `ADM037` | City Builder | `/admin/city-builder` | **IMPLEMENTED** | Opens the canonical City project dashboard with SettlementWorld ownership, geometry counts/version, and project creation. |
| 257 | `TOO001` | Wireframe Builder | `/tools/wireframe-builder` | **IMPLEMENTED** | Dedicated manifest-backed review queue with links to rendered UI. |
| 258 | `TOO002` | Wireframe Component Library | `/tools/wireframe-builder/components` | **IMPLEMENTED** | Dedicated reviewed shared-component library. |
| 259 | `TOO003` | Wireframe Templates | `/tools/wireframe-builder/templates` | **IMPLEMENTED** | Dedicated reviewed wireframe-template catalog. |
| 260 | `GAM001` | Game Viewport | `/game` | **IMPLEMENTED** | Authenticated player-safe runtime reads location/turns and persists freeform player input. |
| 261 | `GAME_VIEW_FULL` | Game Viewport — Full | `/game` | **PARTIAL** | All three states reuse the same runtime viewport; the requested state-specific composition/countdown/exit behavior is not fully modeled. |
| 262 | `GAME_VIEW_NO_COUNTDOWN` | Game Viewport — No Countdown | `/game` | **PARTIAL** | All three states reuse the same runtime viewport; the requested state-specific composition/countdown/exit behavior is not fully modeled. |
| 263 | `GAME_VIEW_SINGLE_EXIT` | Game Viewport — Single Exit | `/game` | **PARTIAL** | All three states reuse the same runtime viewport; the requested state-specific composition/countdown/exit behavior is not fully modeled. |
| 264 | `GAM002` | Knowledge Base Graph | `/game/knowledge` | **PLACEHOLDER** | Owner-deferred Knowledge shell only; discovery, graph links, detail content, and timeline projection are absent. |
| 265 | `GAM003` | Bookshelf | `/game/bookshelf` | **PLACEHOLDER** | Empty bookshelf/reader shell; discovered Tome identity, content, and pagination are absent. |
| 266 | `GAM004` | Maps | `/game/maps` | **PARTIAL** | Renders the managed 2D world map with authorized physical Atlas markers; catalog membership is not represented as player discovery. |
| 267 | `GAM005` | Player Globe | `/game/maps/globe` | **PARTIAL** | Renders the authorized physical Atlas catalog on the managed WebGL globe; player discovery and routes remain unavailable. |
| 268 | `GAME_GLOBE_PRESENT` | Player Globe — Present | `/game/maps/globe` | **PARTIAL** | Renders the authorized present physical catalog without inferring discovery or temporal disclosures. |
| 269 | `GAME_GLOBE_TIMELINE` | Player Globe — Timeline | `/game/maps/globe` | **PARTIAL** | Keeps the present catalog visible but explicitly refuses to relabel it as historical because no player-visible timeline projection is persisted. |
| 270 | `CAP01` | Capability Registry | `/admin/capabilities` | **IMPLEMENTED** | Lists persisted versioned definitions and exposes creation without treating legacy concrete keys as precedent for new definitions. |
| 271 | `CAP02` | Capability Definition Editor | `/admin/capabilities/:capabilityDefinitionId` | **IMPLEMENTED** | Edits definitions by appending immutable versions and typed parameter definitions. |
| 272 | `CAP03` | Address and Condition Builder | `/admin/capabilities/condition-builder` | **IMPLEMENTED** | Builds and validates fully bound capability addresses and recursive ALL/ANY/NOT conditions from canonical definitions. |
| 273 | `CAP04` | Evidence Scoring Policies | `/admin/capabilities/scoring` | **IMPLEMENTED** | Reads persisted reward and faction scoring policies, weights, and evidence ownership without inventing missing weights. |
| 274 | `CAP05` | Event and Projection Inspector | `/admin/capabilities/inspector` | **IMPLEMENTED** | Inspects append-only events and reduced current state and compares deterministic projection rebuilds. |
| 275 | `CAM006` | Book Grouping Membership Editor | `state-only under /admin/campaign/planner` | **IMPLEMENTED** | Edits explicit disjoint Book membership as one logical grouping value while keeping the locked Opposing Faction overlay derived and read-only. |
| 276 | `CAM007` | Campaign Planner — Custom Column View | `/admin/campaign/planner` | **IMPLEMENTED** | Persists local column order and visibility preferences without mutating CampaignPlacement or Book Grouping data. |

## Principal implementation evidence

- Dispatch and generic admin fallback: `apps/web/src/screens/PacketScreen.tsx`, `apps/web/src/screens/admin/AdminPage.tsx`
- Public/auth/account/store: `apps/web/src/screens/public/`, `apps/web/src/screens/auth/`, `apps/web/src/screens/account/`, `apps/web/src/screens/store/`
- Admin task pages: `apps/web/src/screens/admin/`
- Player/tool pages: `apps/web/src/screens/game/GamePage.tsx`, `apps/web/src/screens/tools/ToolsPage.tsx`
- Import capability split: `apps/web/src/screens/admin/EntityImportPage.tsx`, `apps/web/src/routes/api/admin/data/$entityKey/import.ts`
- Canonical registry/routing: `apps/web/src/data/page-manifest.json`, `apps/web/src/lib/page-manifest.ts`
