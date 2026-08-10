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
- External service owners: AWS S3, Resend, Stripe
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
| Assets/media | None | Static visual assets only until storage/upload is settled |
| Atlas | None | Manifest-validated Atlas data loader and Atlas views |
| Campaign | None | Campaign assignment service and planner state |
| Puzzle | None | PuzzleBlueprint library/editor and deterministic generator boundary |
| City Builder | None | One canonical city-geometry model with derived projections |
| Game runtime | None | Dedicated game shell and player-safe view model |
| Commerce | None | Stripe payment port and Printful fulfillment port; no alternate providers |
| Operations | None | Read-only operations/release adapters until real hooks are supplied |

## Persistence and schemas

- Persistence technology at intake: none.
- Application schema at intake: none.
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

Atlas R08 supplies one unresolved canonical location: Highcourt/Ascendancy
`SITE-0401` has no approved latitude/longitude. It remains visibly pending and is
not placed by inference.

## Owner decisions still required

Independent UI, route/state, domain-validation, and settled calculation work can
continue. Only these dependent slices remain blocked:

### ODR-HEIRLOOM-VALUES

- Subsystem: Story/Companion
- Blocked slice: validating or persisting a Companion Heirloom selection
- Missing decision: exact allowed Heirloom values
- Checked: owner ledger, current types, Mermaid 03, reviewed Companion screens
- Current safe work: render the Companion relation without inventing enum members

### ODR-SETTLEMENT-PERSISTENCE

- Subsystem: Settlement
- Blocked slice: permanent Found City/Migrate population-history writes
- Missing decision: canonical persistence/history shape and exact Human founding allocation
- Checked: owner ledger, current types, Mermaid 07-10, implementation contracts,
  Atlas R08 data input
- Current safe work: implement validated same-world Breed calculations, atomic
  service boundary, preview, and UI without fabricating a history subsystem

### ODR-CAPABILITY-RUNTIME

- Subsystem: Capability/Knowledge
- Blocked slice: mutating capability state, thresholds, awards, and disclosure state
- Missing decision: capability keys, events, thresholds, reset rules, and Knowledge disclosure mutation semantics
- Checked: current compact types, Mermaid 14/31, reviewed admin/player screens
- Current safe work: read-only definition/editor surfaces and player-safe view models

### ODR-PUZZLE-RUNTIME

- Subsystem: Puzzle
- Blocked slice: authoritative countdown, retry, and challenge lifecycle behavior
- Missing decision: timer start/expiry, retry, attempt, and server-authority semantics
- Checked: PuzzleBlueprint contract, Mermaid 15/16, reviewed Puzzle screens
- Current safe work: 70-blueprint library UI, exactly two hints, deterministic test generation, answer validation, and alternate presentation checks

### ODR-ASSET-STORAGE

- Subsystem: Assets/Media
- Blocked slice: persistent upload/publication
- Missing decision: storage provider/path and managed metadata/rights model
- Checked: owner ledger, implementation contracts, Mermaid 32, reviewed asset screens
- Current safe work: local visual references and non-mutating manager UI

### ODR-OPERATIONS-HOOKS

- Subsystem: Operations
- Blocked slice: service restart and release execution
- Missing decision: real service/status/deployment API or scripts and authorization model
- Checked: operations contract and reviewed Operations/Release screens
- Current safe work: read-only status/release UI; no deployment or production mutation

## Intake verification

- Mandatory packet files were read in the required order.
- All 269 manifest entries were inventoried.
- The 275-page review PDF (cover, five TOC pages, 269 active wireframes) was
  text-inventoried and visually reviewed via contact sheets plus key full-size pages.
- The v11.3 packet passed its complete `MANIFEST_v11_3.sha256` verification after
  exact recovery of nine source PNGs accidentally touched during thumbnail review.
- No production system was contacted or mutated.
