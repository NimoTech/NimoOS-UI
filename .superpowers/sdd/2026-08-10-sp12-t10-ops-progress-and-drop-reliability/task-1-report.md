# Task 1 report: opsRow.ts pure helpers

## What was changed

Created two new files, exactly as specified in the brief (no deviation from the
brief's code):

- `src/files/util/opsRow.ts` — implements `opsTaskPercent`, `opsTaskLabelKey`,
  `opsTaskBasename`.
- `src/files/util/opsRow.test.ts` — the brief's test suite verbatim.

No existing files were touched. `src/files/util/fileOps.ts` (source of `FileTask`
and the pre-existing `taskPercent`) was read-only verified to match the brief's
assumed shape (`FileTask` has exactly `id/type/finished/status/processing_path/
processed_size/total_size/to`; `taskPercent` returns `0` for unknown total) and
was left untouched.

## Step 2: confirm red before implementation

Command: `pnpm exec vitest run src/files/util/opsRow.test.ts`

Result: FAIL as expected —
`Error: Failed to resolve import "./opsRow" from "src/files/util/opsRow.test.ts"`.
0 tests ran (file failed to even parse), consistent with the brief's expectation.

## Step 4: confirm green after implementation

Command: `pnpm exec vitest run src/files/util/opsRow.test.ts`

Result: PASS — `Test Files 1 passed (1)`, `Tests 9 passed (9)`.

Note: the brief's Step 4 says "PASS, 13 例全绿" (expects 13 passing). Counting the
`it()` blocks in the brief's own test file: `opsTaskPercent` has 4, `opsTaskLabelKey`
has 2, `opsTaskBasename` has 3 — total 9, matching what actually ran. This is a
harmless numbering slip in the brief text, not a discrepancy in the code or test
file (which was copied verbatim). Flagging per the honesty requirement.

## Step 5: mutation check

Changed the null-guard branch in `opsTaskPercent` from:

```ts
if (!task.total_size || task.total_size <= 0) return null
```

to:

```ts
if (!task.total_size || task.total_size <= 0) return 0
```

Reran: `pnpm exec vitest run src/files/util/opsRow.test.ts`

Result: 1 failed, 8 passed. The failing test was exactly the target:

```
FAIL  src/files/util/opsRow.test.ts > opsTaskPercent > returns null when the total
size is unknown, so callers do not draw a false 0%
AssertionError: expected +0 to be null
```

No other test names went red — the other 8 tests (including "returns 0 when the
size is known but nothing has been processed yet", which also expects a literal
`0` but from a different code path) stayed green, confirming the mutation was
caught precisely by the test it was meant to be caught by, with no collateral
false negatives.

Reverted the mutation (`return null` restored). Reran the same command:
`Test Files 1 passed (1)`, `Tests 9 passed (9)` — confirmed back to green.

## Concerns

None. No test passed both before and after the mutation in a way that would
indicate a weak/no-op assertion — the one test targeted by the mutation was the
only one to flip, and it flipped for the expected reason (`null` vs `0`).

`opsRow.ts`'s `opsTaskPercent` and `fileOps.ts`'s `taskPercent` now coexist with
different semantics by design (documented in the new file's docstring), per the
brief's explicit instruction not to unify them.

## Commit

```
git add src/files/util/opsRow.ts src/files/util/opsRow.test.ts
git commit -m "feat(files): add pure helpers for file-operation progress rows

opsTaskPercent returns null rather than 0 for an unknown total size: a 0%
bar claims progress the backend never reported. taskPercent in fileOps.ts
keeps its old semantics for its own callers.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
