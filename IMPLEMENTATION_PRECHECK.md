# Echoes of Eidolon Implementation Precheck

This is a local implementation record, not product authority. The supplied v11.3
closed-world packet and current workspace inputs remain unchanged and controlling.

## Starting repository

- Workspace: `/home/bobby/echoes-of-eidolon`
- Starting revision: no revision; this was an uninitialized new repository.
- Initial branch created by `git init`: `main`.
- Legacy carry-over: none. No prior repository, implementation, schema, route,
  test, deployment, or convention is an input to this build.

## Owner-supplied repository contract

- Node: `22.22.0`
- Package manager: `pnpm@10.33.2`
- Workspace: enabled
- Web application path: `apps/web`
- Required root files: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- Required app files: `apps/web/package.json`, `apps/web/tsconfig.json`
- Required verification order: lint, typecheck, unit, integration, E2E, build
- Module format: ESM
- Application: React 19, TanStack React Start/Router/Query/Table, Vite 8,
  Nitro 3
- UI: Tailwind CSS 4 and React Hook Form
- Data: PostgreSQL, Prisma 7 with `@prisma/adapter-pg`, Zod, AJV, YAML
- Authentication: Better Auth `1.6.25`, Prisma adapter, Passkey
- External service owners: DigitalOcean Spaces through its S3 API, Resend,
  Stripe, and Printful for fulfillment only
- Testing: Vitest, Testing Library, jsdom, Playwright
- Development/build: TypeScript 6, TSX, ESLint

## Existing code owners

There were no application files or existing code owners at intake. The following
owners must therefore be established by the new implementation without changing
product semantics:

| Concern | Existing owner at intake | New implementation boundary |
|---|---|---|
| Authentication/session | None | Auth/session adapter and Auth shell |
| Data access | None | Typed repository interfaces; no invented domain records |
| Routes | None | One manifest-backed route/state registry |
| Assets/media | None | One final-byte managed-asset pipeline backed by DigitalOcean Spaces through its S3 API |
| Atlas | None | Manifest-validated Atlas data loader and Atlas views |
| Campaign | None | Campaign assignment service and planner state |
| Puzzle | None | PuzzleBlueprint library/editor and deterministic generator boundary |
| City Builder | None | One canonical city-geometry model with derived projections |
| Game runtime | None | Dedicated game shell and player-safe view model |
| Commerce | None | Stripe payment port and Printful fulfillment port; no alternate providers |
| Operations | None | Read-only operations/release adapters until real hooks are supplied |

## Persistence and schemas

- Persistence technology at intake: none; the implementation now uses PostgreSQL
  through Prisma 7 and `@prisma/adapter-pg`.
- Application schema: `apps/web/prisma/schema.prisma`.
- Current field/relationship contract:
  `Echoes_UI_Closed_World_Implementation_Handoff_v11_3/Echoes_UI_Wireframe_Rebuild_v11_3_CLOSED_WORLD/types/eidolon-domain-types.ts`.
- Current Atlas schemas/contracts:
  `EIDOLON_ATLAS_RECON_NIMBUS_P3V6_20260809_R08_CANONICAL_INTEGRATION_RELEASE/contracts/`.
- Implementation rule: interfaces and transaction services may be built around
  settled contracts, but unresolved persisted shapes are not encoded as database
  migrations while their semantics remain open.

## Route/state inventory for foundation and shells

`data/page_manifest_v11_2.json` contains 269 active review screens/states. The
foundation task owns one registry covering these shell groups:

| Shell group | Manifest entries | Route/state notes |
|---|---:|---|
| Public | 38 | `/`, features, gameplay, release/status, donate, contact, legal, invite |
| Auth | 10 | `/auth/*`; Verify Email remains an owning-flow modal |
| Account | 21 | `/account/*` and shared `/settings`; Change Email remains modal state |
| Store | 12 | `/store/*`; checkout state variants stay within Store |
| Admin | 151 | `/admin/*`; includes data, Atlas, Campaign, Puzzle, City, assets, operations |
| Game | 14 | `/game*` plus state-only views; dedicated game shell and BottomBar |
| Tools/review | 5 | `/tools/*` and `/review/*`; internal implementation/review surfaces |
| State-only | 18 | Owned overlays/selections with no invented standalone route |

The manifest, rather than a second hand-written sitemap, is the route/state
inventory. Duplicate paths represent approved state variants, not duplicate routes.

## Workspace handout disposition

| Workspace artifact | Classification | Disposition |
|---|---|---|
| Extracted v11.3 closed-world handoff packet | Per `HANDOUT_DISPOSITION_REGISTER.md` | Binding decisions, implementation inputs, visual references, and reference-only validation files are used only in their registered roles. |
| `Echoes_UI_Closed_World_Implementation_Handoff_v11_3.zip` | `REFERENCE_ONLY` | Untouched delivery container used only for integrity recovery. |
| Extracted R08 canonical Atlas integration release | `DATA_INPUT` | Atlas data and immutable data contracts only; it does not create app workflows or architecture. Runtime loading begins at exact root `atlas-data-release.json`. |
| `EIDOLON_ATLAS_RECON_NIMBUS_P3V6_20260809_R08_CANONICAL_INTEGRATION_RELEASE.zip` | `DATA_INPUT` | Untouched delivery container for the same Atlas release. |
| Atlas `MASTER_IMPLEMENTATION_DATA_HANDOFF.md`, `README_DATA.md`, and R08 manifest/addendum | `IMPLEMENTATION_INPUT` for Atlas data loading | Establish bootstrap, validation, counts, coordinate rules, and the pending SITE-0401 exception. |
| Atlas canonical `data/`, `world.gpkg`, `contracts/`, and `src/globe-transform.*` | `DATA_INPUT` | Canonical application data/contract inputs. |
| Atlas `diagnostics/`, `reports/`, `review/`, reconstruction READMEs, and tests | `REFERENCE_ONLY` | QA and reconstruction context only; not runtime records or product subsystems. |
| Packet `assets/*` | `VISUAL_REFERENCE` | Copied into implementation only where required by an approved screen. |
| Packet reviewed PDF, manifest, types, diagrams, and implementation contracts/plan | `IMPLEMENTATION_INPUT` | Used according to the packet authority order. |
| Packet validation JSON and SHA manifests | `REFERENCE_ONLY` | Integrity/review checks only, never product logic. |
| Owner-supplied feature PNGs, soundtrack MP3s, captioned MP4s, logos, and Atlas image/texture files under `/home/bobby/Dropbox` | `DATA_INPUT` for managed assets | Source bytes only. They are sanitized, hashed from final bytes, renamed to the SHA-256 identity, and served from DigitalOcean Spaces; workstation paths and source filenames never become public identity. |

Atlas R08 supplies one unresolved canonical location: Highcourt/Ascendancy
`SITE-0401` has no approved latitude/longitude. It remains visibly pending and is
not placed by inference.

## Owner decisions still required

Independent UI, route/state, domain-validation, and settled calculation work can
continue. Only these dependent slices remain blocked:

### ODR-CAPABILITY-RUNTIME

- Subsystem: Capability/Knowledge
- Blocked slice: authoring concrete capability keys, authored score ceilings,
  achievement thresholds/chains, and disclosure requirements
- Missing decision: the actual authored definitions and thresholds; the supplied
  append-only event/reducer and disclosure operation contracts do not supply those records
- Checked: current compact types, Mermaid 14/31, reviewed admin/player screens
- Current safe work: validate supplied definitions/events, reduce derived state,
  and project disclosures without fabricating authored keys or thresholds

### ODR-GUARDIAN-CONSENT

- Subsystem: Authentication
- Blocked slice: enabling registration for ages 14–17
- Missing decision: guardian-consent verification method and evidence capture
- Checked: direct owner age/privacy rules and current signup screen
- Current safe work: keep the minor option unavailable and collect no exact age or date of birth

### ODR-MERCHANDISE-MAPPING

- Subsystem: Commerce
- Blocked slice: activating the three merchandise products
- Missing decision: exact Conjunction artwork-to-product mapping and real configured Printful variants
- Checked: direct owner merchandise rules and store wireframes
- Current safe work: render an unavailable catalog state without prices, dimensions, materials, or mappings

### ODR-CALENDAR-SOURCE

- Subsystem: Calendar/Game
- Blocked slice: authoritative ordinal-day lookup and calendar projection
- Missing input: `source_data/eidolon_ordinal_days_v3.json` is specified but is not present in this workspace
- Checked: direct owner calendar rules and repository file inventory
- Current safe work: render an honest unavailable state; do not reconstruct rows arithmetically

### ODR-PRINTFUL-CONFIGURATION

- Subsystem: Commerce
- Blocked slice: submitting paid merchandise for fulfillment
- Missing input: no Printful credential/configuration key is present in `.local.example/secrets`
- Checked: direct owner provider boundary and local secret-key inventory only; secret values were not read
- Current safe work: enforce that fulfillment cannot begin before confirmed Stripe payment and leave fulfillment unavailable

### ODR-R007-SCREEN-REGISTRY

- Subsystem: route/state registry and review acceptance
- Blocked slice: claiming the final R007 screen count and Admin gap acceptance
- Conflicting authority: the supplied v11.3 packet manifest contains 269 active entries, while the later direct owner requirement says the R007 screen count remains exactly 189 and the Admin gap stays empty
- Missing decision/input: the authoritative 189-entry R007 registry, or an explicit disposition identifying which 80 packet entries are not counted; the meaning and exact bounds of the Admin gap also require an authoritative registry field or range
- Checked: all 269 packet manifest entries, the 275-page review PDF inventory, and the later direct owner requirement
- Current safe work: preserve the packet registry without deleting, merging, or reclassifying screens by inference; do not claim final count acceptance

### ODR-SETTLEMENT-NAMING-PROMPT

- Subsystem: Found City / Prompt Manager
- Blocked slice: exposing the Found City mutation through HTTP
- Missing decision/input: the exact server-owned NAMING prompt text, purpose, status, and response contract
- Checked: settlement founding requirements, PromptRecord/PromptVersion contract, reviewed AT004 screen, and current owner inputs
- Current safe work: keep the atomic internal founding service; reject browser-authored prompt fields and return unavailable until the server-owned prompt source is configured

### ODR-RESET-WORLDS

- Subsystem: Settlement reset / City Builder
- Blocked slice: exposing the destructive `RESET WORLDS` operation
- Missing decision/input: the City graph persistence schema and the authoritative founder Species/Breed allocation input used by the immediate three-world reseed
- Checked: typed confirmation, one-transaction reset, Site priority, 1,600-per-Species allocation, current Prisma schema, settlement services, and reviewed Atlas/City screens
- Current safe work: preserve the deterministic Site-priority and founder-allocation validators; do not invent City deletion targets, founder records, or reseeded population events

## Subsequent owner inputs reconciled

The initial unresolved list above has been narrowed by later direct owner input:

- the exact Heirloom enum is supplied;
- SettlementWorld and append-only SettlementPopulationEvent ownership, ordering,
  replay, founding allocation, founding loss, ordinary migration, and reset rules are supplied;
- the Puzzle timer starts only on acceptance and lasts exactly 2,160,000 seconds,
  with exactly two authored answer-free hint levels;
- managed assets use sanitized final bytes, SHA-256 object identity, deduplication,
  purpose links, and DigitalOcean Spaces through the S3 API;
- the production deployment sequence, dry-run behavior, backup-before-migration,
  health check, and application rollback boundary are supplied.

These are no longer owner-decision gaps. The managed-asset upload was explicitly
authorized and completed through the final-byte pipeline. Production deployment
and unrelated production data mutation remain unauthorized until separately requested.

## Intake verification

- Mandatory packet files were read in the required order.
- All 269 manifest entries were inventoried.
- The 275-page review PDF (cover, five TOC pages, 269 active wireframes) was
  text-inventoried and visually reviewed via contact sheets plus key full-size pages.
- The v11.3 packet passed its complete `MANIFEST_v11_3.sha256` verification after
  exact recovery of nine source PNGs accidentally touched during thumbnail review.
- During intake verification, no production system was contacted or mutated.

## Assumption audit

The implementation was re-audited after fabricated merchandise presentation
values were found. This section records implementation evidence only; it does not
create product authority.

- Removed merchandise price, dimension, material, and Conjunction-to-product
  mapping claims. Store views now show only the three supplied product types and
  persisted server configuration; unresolved values remain unavailable.
- Removed the browser-authored Found City naming prompt boundary. The HTTP route
  accepts only Site, WorldKey, year, and departure rows and remains unavailable
  until the exact server-owned prompt source exists.
- Replaced account-session client listing with a server projection. Other-session
  bearer tokens never reach the account UI; the browser receives only a session
  identifier, current/other state, last activity, expiry, IP, and device string.
- Corrected perk projection so an ACTIVE perk is player-visible only when the
  account also has an active membership entitlement. Authorization role and beta
  eligibility remain independent.
- Made invitation, invitation approval, authorization-role update, Witness,
  Companion, Puzzle Blueprint, and migration objects fail closed on unknown
  fields instead of silently stripping fabricated submissions.
- Production application source contains no Patron, staff, Square, R06 release
  binding, fabricated merchandise values, public WorldKey/faction spoiler, or
  hard-coded example domain record identity. `R06` remains only as the required
  `RegionId.R06` enum token among `R01..R25`.
- Hard-coded monetary, duration, calendar, count, range, evidence-weight, and
  access values remaining in application code were traced to direct owner input
  or the packet authority. Unresolved authored capability keys/ceilings,
  merchandise mappings/variants, calendar rows, legal prose, runtime records,
  and provider outcomes are not synthesized.
