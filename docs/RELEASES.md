# Releases and versioning

## Current state

- Target application release: `0.2.0`.
- Canonical note: `docs/release-notes/0_2_0.md`.
- Status: `DRAFT`.
- Release date: `null` until an owner-authorized publication action.
- Authoritative previous release/tag: none. The repository has no earlier release tag or canonical published note.

## Canonical files

Release `X.Y.Z` maps to `docs/release-notes/X_Y_Z.md`. These reviewed Markdown files are the sole release-note source. Runtime data is generated deterministically from them; it is never separately authored.

Patch releases use the same system. There is no competing patch-note archive.

## Lifecycle

1. Establish the semantic target version.
2. Create its canonical Markdown note in `DRAFT` state with a null date.
3. Synchronize release-bearing package versions.
4. Update the note and traceability evidence throughout implementation.
5. Run `pnpm release:draft --version X.Y.Z` to create a noncanonical review draft from approved commit footers when useful.
6. Run `pnpm release:check` and the cumulative `pnpm verify` gate.
7. Obtain owner review.
8. Change status/date only in an explicitly authorized publication change.

Draft generation never overwrites canonical notes and never publishes, tags, deploys, or creates a GitHub Release. Published notes are immutable except for a deliberately documented factual, legal, privacy, or security correction. A superseded note retains its original publication date.

The release gate fails closed on package/version drift, malformed or duplicate canonical notes, filename/version mismatch, invalid status dates, unsafe public content, generated artifact drift, and missing current-release authority.
