# Echoes of Eidolon repository instructions

The current `bkalaf/echoes-of-eidolon` repository is the sole application authority. Do not restore architecture or release assumptions from retired repositories.

## Release authority

- Current target: `0.2.0`.
- Read `docs/RELEASES.md` and `docs/COMMITS_AND_RELEASE_NOTES.md` before implementation or release work.
- The canonical reviewed note is `docs/release-notes/0_2_0.md`.
- Package versions and the canonical current note must remain synchronized.
- Update release notes for every player-visible or operator-visible change.
- Generated notes are drafts only. Owner review is required before publication.
- A `DRAFT` release has no release date and must not be exposed publicly.

## Delivery rules

- Use TDD: add and run a failing test before implementing behavior, then run focused and cumulative gates.
- Preserve unrelated work and existing hard requirements.
- Maximum agent concurrency is two: one coordinator and at most one worker. Workers may not delegate.
- Release publication, tags, GitHub Releases, provider mutation, migrations, and production deployment require separate owner authorization.
