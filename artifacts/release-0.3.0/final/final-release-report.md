# Release 0.3.0 Blocked

The audited defects were remediated locally in `/home/bobby/echoes-of-eidolon` on `main`, based on `b503f48a39c6be823fa295c8f2bfb305107e25ef`. The repair is not committed, so no immutable candidate SHA or candidate-bound PASS is claimed.

## Completed remediation

- Puzzle import defaults to verify-only; apply requires explicit mode and target; invalid flags fail closed.
- Four authored tutorial generators remain production; 66 generic carriers are `PROTOTYPE_ONLY` and excluded from G08 production coverage.
- Owner UI audits independently compare the 34 generic table/form contracts and fail negative-control omissions.
- Bespoke owner surfaces without independent contracts/rendered relation evidence are explicitly blocked.
- G00-G12 reports all exist and no longer cite the stale base as a tested candidate.
- The 16 cumulative diff whitespace errors are fixed.
- The release-history decision report records both authorized decision paths without changing history.
- The draft release note no longer claims 70 production generators or blanket owner-UI completeness.

## Verification

| Gate | Result |
|---|---|
| Frozen install | PASS |
| Lint | PASS |
| Typecheck | PASS |
| Prisma validate | PASS |
| Navigation | PASS — 292 active, 0 blocking defects |
| Build | PASS |
| Focused remediation | PASS — importer/Puzzle 14/14; owner UI 12/12; gate completeness 1/1 |
| Isolated contention reruns | PASS — 40/40 |
| Full unit | FAIL — 795/801; three intentional release gaps, two sandbox subprocess cases and one timeout pass isolated |
| Integration | FAIL — 58/59; sole failure is the `c1f6b137` release-history subject |
| Diff check | PASS |
| Chromium | BLOCKED — `listen 127.0.0.1:3000` returns EPERM |
| Release check | FAIL — `gitignore changes` violates the configured commit contract |

## Remaining blockers

- Commit and freeze the local repair before rerunning candidate-bound gates.
- Owner decision on the documented release-history governance exception versus separately authorized clean reconstruction.
- Exact founding-population authority and allocation/remainder rules.
- Live taxonomy export plus owner conflict decisions.
- Sixty-six authored Puzzle generators and named accessibility/security/owner/browser reviews.
- Independent bespoke owner read/write contracts and rendered browser evidence.
- Real Chromium execution in an environment that permits the local web server.

No push, merge, database mutation, migration, deployment, tag, GitHub Release, publication, extra worktree, or branch creation was performed.
