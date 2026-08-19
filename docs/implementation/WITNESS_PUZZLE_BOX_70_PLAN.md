# Witness Puzzle Box 70 — implementation plan

## Decision

Adopt the 70-Blueprint proposal as a Release 0.3.0 package while preserving the repository's existing Puzzle owners. Do not create a parallel Puzzle model or component registry.

The first tranche delivers a checksum-pinned, transactional Blueprint import and an administrator-only working prototype lab for all 70 methods. The prototype lab is an interaction and validation vertical slice, not evidence that all 70 production generators, accessibility equivalents, or live campaign bindings are complete.

## Imported package

| Invariant | Required |
|---|---:|
| Blueprint roots | 70 |
| Difficulty tiers | 5 × 14 |
| Method families | 9 |
| Ordered authored hints | 2 per Blueprint |
| Generator version | Immutable `1.0.0` source value |
| Live runtime records created by import | 0 |
| Source SHA-256 | `a269001ef1e4f274caa956e45907811bb097a08b2fa0d83f6f62ed69e3138419` |

| Family | Blueprints | Prototype surface |
|---|---:|---|
| Text / language / literary | 10 | Document comparison |
| Crypto / numeric / data | 10 | Data transformation |
| Visual / color / optical | 8 | Color-independent visual layers |
| Spatial / folding / geometry | 8 | Keyboard-operable spatial board |
| Audio / music / spectral | 8 | Captioned audio sequence |
| Logic / constraint | 8 | Constraint matrix |
| Historical / research | 6 | Claim and source chain |
| Construction / simulation | 6 | Discrete mechanism board |
| Cross-modal | 6 | Equivalent cross-modal surface |

## Architecture

- `PuzzleBlueprint` remains the stable root.
- `PuzzleBlueprintVersion` owns versioned design data and immutable generator version.
- `PuzzleHintTemplate` owns exactly two ordered answer-free authored hints.
- `puzzle-blueprint-bank-70.csv` remains byte-identical to the reviewed proposal input.
- `puzzle-prototype-catalog-70.json` contains answer-free sample metadata only. Runtime sample answers and clue carriers are derived in memory with a domain-separated HMAC keyed by the existing server authentication secret; no plaintext answer or answer hash is committed.
- The administrative GET returns the solvable clue carrier but no answer, seed, validation token, or server key. POST comparison is constant-time and never starts the live timer.
- `PUZCMP-*` identifiers remain provenance handles pending reconciliation with the master shared-component registry.

## Phase 1 — intake and working vertical slices

Status: implemented in this tranche.

- Validate the exact source checksum and RFC 4180 header contract.
- Parse and validate all 70 records with existing family/tier/hint rules.
- Reconcile roots and immutable versions in one serializable transaction.
- Fail closed on any existing root, design, version, or hint conflict.
- Support read-only verification and idempotent rerun.
- Add nine reusable prototype surfaces covering every Blueprint.
- Validate sample answers server-side; keep answer-bearing data out of client projection.
- Add direct entry from Puzzle administration and per-Blueprint test routes.
- Update the 0.3.0 draft release note and intake audit.

## Phase 2 — production generator tranche

Status: planned.

Group work by method family, not by 70 isolated components. Each generator must:

- derive its seed from the approved opaque keyed inputs;
- produce player-safe carrier data and a server-only validation representation;
- reject accidental alternate solutions with an exhaustive/CSP/SAT-equivalent proof;
- preserve declared answer format, two hint levels, and immutable version;
- generate equivalent keyboard, low-vision, reduced-motion, captioned, and non-3D modes where applicable;
- include deterministic regeneration, decoy rejection, divergence, and answer-leakage tests.

Recommended order:

1. Tutorial four: PZB-011, PZB-012, PZB-037, PZB-021.
2. Remaining Tier 1 and Tier 2 families.
3. Tier 3 generators.
4. Tier 4 research/logic/cross-modal generators.
5. Tier 5 showpieces, including PZB-029 and PZB-041.

## Phase 3 — live Puzzle bounded context

Status: owner-reviewed design required before migration.

Add only the missing runtime owners after schema review:

- `PuzzleInstance`;
- `PuzzleAssignment`;
- `PuzzleAttempt`;
- runtime hint-reveal state;
- `PuzzleSolutionValidation`;
- `PuzzleFailure`;
- `PuzzleMethodFamily` cooldown state;
- `WitnessPuzzleThemeBinding`.

The existing `PuzzleChallengeAccepted` timer remains the only accepted timer start. This phase requires separate migration authorization and integration tests against PostgreSQL.

## Phase 4 — Campaign and Witness integration

Status: blocked on canonical challenge bindings.

- Author explicit Campaign/Book/Witness/Blueprint binding records.
- Keep narrative skin separate from puzzle logic.
- Never use a Witness name as a canonical answer.
- Apply player-history, failure exclusion, accessibility, device, and method-family cooldown scoring.
- Persist selection and rejection reason codes.
- Keep tutorials outside the live 25-day timer.

## Phase 5 — player release hardening

Status: planned after generator/runtime completion.

- Disabled-player review of every declared equivalent mode.
- Answer-leakage and source-map audit.
- Brute-force, rate-limit, replay, and deadline tests.
- Mobile and low-spec performance budgets.
- Browser E2E for accept, hint 1, hint 2, submit, solve, fail, abandon, and reconnect.
- Operator preview/support replay with privileged version-pinned receipts.
- Analytics verification without raw PII or canonical answer persistence in ordinary logs.

## Definition of done for Phase 1

- [x] Exact 70 unique IDs, PZB-001 through PZB-070.
- [x] Exactly 14 per difficulty tier and approved family totals.
- [x] Exact checksum-pinned source is present.
- [x] Transactional, idempotent, fail-closed importer and verify-only mode exist.
- [x] No live assignments, instances, attempts, Witness bindings, or timers are created.
- [x] Every Blueprint has an interactive administrator prototype surface.
- [x] Sample validation is server-side; the repository and browser projection contain no plaintext answer or answer hash.
- [x] Focused contract and component tests pass.
- [ ] Full repository verify gate passes in CI on the repository's pinned Node 22.22.0 runtime.
- [ ] Owner reviews the draft pull request.
- [ ] Import is run against an explicitly authorized target database.
- [ ] Production deployment is separately authorized.
