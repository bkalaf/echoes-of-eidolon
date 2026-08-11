# Commit and release-note convention

## Subject

Use:

```text
<type>(<scope>): <imperative summary>
```

Supported types are `feat`, `fix`, `perf`, `refactor`, `security`, `docs`, `test`, `build`, and `chore`.

Current scopes include `web`, `auth`, `account`, `store`, `commerce`, `admin`, `data`, `atlas`, `city`, `campaign`, `puzzle`, `game`, `assets`, `prompts`, `ops`, `docs`, and `release`.

## Required prospective footer

Every new commit changing player-visible or operator-visible behavior includes:

```text
Release-Note: <one player/operator-readable sentence>
Release-Audience: PLAYERS|OPERATORS|BOTH
```

Use `Release-Note: none` when no public or operator note is warranted. Old history is not rewritten to add footers; the `0.2.0` traceability audit validates historical work directly.

## Draft mapping

- `feat` -> Added
- `fix` -> Fixed
- `perf` -> Changed unless invisible
- `security` -> Security & Privacy
- other supported types -> omitted unless an explicit release footer identifies visible behavior

Only the `Release-Note` footer is eligible for generated public text. Commit bodies, issue references, secrets, credentials, provider identifiers, internal paths, internal Atlas package identities, and hidden story architecture are excluded. Public copy may say `branching` or `multiple stories`; it must never say `hidden branching`.

Generated drafts require human review and cannot publish a release.
