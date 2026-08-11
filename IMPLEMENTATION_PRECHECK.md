# Echoes of Eidolon Implementation Precheck

This is a local implementation record, not product authority. The supplied v11.3
closed-world packet and current workspace inputs remain unchanged and controlling.

## Starting repository

- Workspace: `/home/bobby/echoes-of-eidolon`
- Repository: `bkalaf/echoes-of-eidolon`.
- Branch: `main`.
- Audited starting revision: `a03b6588e0bba4f8c1df6f62bc12d94ecc3d014b`.
- Starting revision matched `origin/main` when implementation began.
- The repository was inspected as a fresh rebuild. Existing schema, migrations,
  source, tests, handoff artifacts, and deployment boundaries were treated as
  live inputs; no state from an older checkout was assumed.

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

## Existing and extended code owners

The starting repository already contained the application foundation. This work
extends those repository-native owners rather than creating parallel systems:

| Concern | Repository owner | Current implementation boundary |
|---|---|---|
| Authentication/session | Better Auth, access services, Auth/Account shells | Preserve canonical User/session ownership and fail-closed authorization |
| Data access | Prisma schema, forward migrations, typed import services | Corrected Breed, Research, capability, Campaign, runtime, release, commerce, and settings contracts |
| Routes | Manifest-backed TanStack route/state registry | Server-owned API projections and task-specific shell dispatch |
| Assets/media | ManagedAsset, AssetPurposeLink, one importer | Final-byte sanitization, technical metadata, safe ZIP extraction, remote and DB/JSON drift verification |
| Atlas | R08 validator/import boundary and Atlas screens | Owner WebGL2 sphere renderer and shared persisted Site/POI/Settlement selection |
| Campaign | Campaign and CampaignPlacement | Canonical book membership, inclusive CSS Grid row spans, collision lanes, and mirrored duologies |
| Puzzle | PuzzleBlueprint models/services | Immutable versions, exact hint validation, player acceptance, and persisted countdown |
| City Builder | City, Parcel, Street, Building | Canonical geometry persistence; destructive reset remains blocked by missing exact reset/reseed input |
| Game runtime | GameSession, GameTurn, Game shell | Authenticated player-safe location/turn, Puzzle, Calendar, and shared Settings projections |
| Commerce | Store/Order/Stripe persistence | Signed idempotent Stripe confirmation and configured Printful adapter after payment |
| Operations | Release, ReleaseNoteItem, DeploymentRecord | Bounded release metadata and version surfaces; deployment remains a separate explicit authorization boundary |

## Persistence and schemas

- Persistence technology at intake: PostgreSQL through Prisma 7 and
  `@prisma/adapter-pg`; this work uses forward-only migrations.
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
- Current safe work completed: the persisted `CalendarOrdinal` projection and exact
  486-row validator are implemented. The Game calendar renders canonical rows when
  installed and an honest empty state otherwise; it does not synthesize names.

### ODR-PRINTFUL-CONFIGURATION

- Subsystem: Commerce
- Blocked slice: external production activation of paid merchandise fulfillment
- Missing input: production Printful credential/store configuration, configured
  StoreVariant external variant references, and the owner-approved Stripe shipping-country allowlist
- Checked: direct owner provider boundary and local secret-key inventory only; secret values were not read
- Current safe work completed: the typed Printful adapter, strict recipient and
  configured-line validation, external-order idempotency, Stripe shipping capture,
  retry-safe webhook sequencing, and tests are implemented. No provider request is
  made without persisted Stripe payment confirmation.

### ODR-SETTLEMENT-NAMING-PROMPT

- Subsystem: Found City / Prompt Manager
- Blocked slice: exposing the Found City mutation through HTTP
- Missing decision/input: the exact server-owned NAMING prompt text, purpose, status, and response contract
- Checked: settlement founding requirements, PromptRecord/PromptVersion contract, reviewed AT004 screen, and current owner inputs
- Current safe work: keep the atomic internal founding service; reject browser-authored prompt fields and return unavailable until the server-owned prompt source is configured

### ODR-RESET-WORLDS

- Subsystem: Settlement reset / City Builder
- Blocked slice: exposing the destructive `RESET WORLDS` operation
- Missing decision/input: the exact destructive reset scope/recovery contract and
  authoritative founder Species/Breed allocation input used by the immediate three-world reseed
- Checked: typed confirmation, one-transaction requirement, Site priority,
  1,600-per-Species allocation, current City geometry schema, settlement services,
  and reviewed Atlas/City screens
- Current safe work: preserve deterministic Site-priority and founder-allocation
  validators; do not invent deletion targets, founder records, or reseeded population events

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

These are no longer owner-decision gaps. The current 269-row v11.3 registry is
the controlling active count under the complete implementation prompt; obsolete
189/222/272/361 counts are not applied. Managed objects were reconciled by final
byte identity. Production asset-policy mutation and deployment remain paused
until the owner gives the separately requested authorization.

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
- Corrected typed imports for packet fields declared optional (`Tome.author`,
  Constellation coordinates, Pillar domain/seat, and SpeciesGroup description):
  omission is accepted and compares idempotently with persisted PostgreSQL
  `NULL`; the importer does not require an invented explicit-null convention.
- Production application source contains no Patron, staff, Square, R06 release
  binding, fabricated merchandise values, public WorldKey/faction spoiler, or
  hard-coded example domain record identity. `R06` remains only as the required
  `RegionId.R06` enum token among `R01..R25`.
- Hard-coded monetary, duration, calendar, count, range, evidence-weight, and
  access values remaining in application code were traced to direct owner input
  or the packet authority. Unresolved authored capability keys/ceilings,
  merchandise mappings/variants, calendar rows, legal prose, runtime records,
  and provider outcomes are not synthesized.
