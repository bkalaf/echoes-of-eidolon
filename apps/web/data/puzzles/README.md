# Witness Puzzle Box data

This directory contains the Release 0.3.0 intake and prototype projections for the approved 70-Blueprint proposal.

- `puzzle-blueprint-bank-70.csv` is the checksum-pinned source import. SHA-256: `a269001ef1e4f274caa956e45907811bb097a08b2fa0d83f6f62ed69e3138419`.
- `puzzle-prototype-catalog-70.json` is the answer-free administrator prototype catalog. It contains no plaintext answer, answer hash, solution walkthrough, seed, or validation token.
- `src/server/puzzle-prototypes.ts` derives each sample answer and clue carrier in memory with a domain-separated HMAC keyed by the existing server authentication secret. The browser receives only the solvable clue carrier.
- `src/domain/puzzle-prototype-catalog.ts` validates the exact 70/14-per-tier/nine-family coverage contract.

Verify the source package without writing:

```bash
pnpm --filter @echoes/web puzzles:import -- --verify-only
```

Apply the idempotent database import only against an explicitly authorized environment:

```bash
pnpm --filter @echoes/web puzzles:import
```

The import creates or verifies `PuzzleBlueprint`, `PuzzleBlueprintVersion`, and two ordered `PuzzleHintTemplate` records. It creates no live instance, assignment, attempt, failure, Witness binding, or timer.
