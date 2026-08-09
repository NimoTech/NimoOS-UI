# Task 4 Report: applyInnerResolutions Implementation

## What Was Implemented

Implemented `InnerPrecheckResult` interface and `applyInnerResolutions` function in `src/files/upload/uploadConflict.ts`. This completes the second round of merge conflict resolution — handling per-file conflicts inside a merged folder after the top-level folder has been accepted as mergeable.

### Key Implementation Details

1. **InnerPrecheckResult interface**: Represents the backend's per-path precheck response with fields:
   - `relativePath: string` — unique path inside the merged folder
   - `exists: boolean` — whether the file exists at destination
   - `size_match?: boolean` — optional field for future use
   - `is_dir?: boolean` — optional field to indicate if target is directory

2. **applyInnerResolutions function**: Applies per-file conflict resolutions with these semantics:
   - **No grouping**: Each entry resolves independently (unlike round 1 which groups by top segment)
   - **Non-colliding paths**: Files with `exists: false` OR never reported in `innerResults` land accepted with `conflictPolicy: ''` (unchanged)
   - **Colliding with no resolution**: Treated as skipped (defensive — prevents silently accepting unresolved collisions)
   - **Action handling**:
     - `'overwrite'`: Sets `conflictPolicy: 'overwrite'`
     - `'keep_both'`: Sets `conflictPolicy: 'rename'` (backend auto-renames single files)
     - `'skip'`: Increments `skippedCount`, entry dropped
     - `'cancelled'`: Increments `cancelledCount`, entry dropped

## Test Evidence

### RED Phase (confirming test failure)
```bash
$ pnpm exec vitest run src/files/upload/uploadConflict.inner.test.ts

❯ src/files/upload/uploadConflict.inner.test.ts (8 tests | 8 failed) 9ms
TypeError: applyInnerResolutions is not a function
```

All 8 tests failed with "applyInnerResolutions is not a function" as expected before implementation.

### GREEN Phase (confirming test pass)
```bash
$ pnpm exec vitest run src/files/upload/uploadConflict.inner.test.ts

Test Files  1 passed (1)
     Tests  8 passed (8)
  Duration  681ms
```

All 8 tests pass:
1. ✓ a path with no counterpart inside the folder lands untouched
2. ✓ a path the backend never reported on is also treated as non-colliding
3. ✓ overwrite on a colliding inner file stamps the overwrite policy
4. ✓ keep_both on a colliding inner file defers naming to the backend
5. ✓ skip drops the inner file and counts it
6. ✓ cancelled drops the inner file and counts separately
7. ✓ a colliding path with NO resolution is skipped, never silently accepted
8. ✓ resolves each path independently — no grouping in the second round

### Full Four-File Test Suite
```bash
$ pnpm exec vitest run src/files/upload/fileConflict.test.ts \
  src/files/upload/uploadConflict.group.test.ts \
  src/files/upload/uploadConflict.apply.test.ts \
  src/files/upload/uploadConflict.inner.test.ts

Test Files  4 passed (4)
     Tests  42 passed (42)
  Duration  809ms
```

Breakdown: fileConflict (10) + uploadConflict.group (10) + uploadConflict.apply (14) + uploadConflict.inner (8) = 42 tests, all green.

### Type Checking
```bash
$ pnpm exec vue-tsc --noEmit
(no output = clean)
```

TypeScript strict mode validation passes cleanly.

## Files Changed

- **Modified**: `src/files/upload/uploadConflict.ts`
  - Added `InnerPrecheckResult` interface (lines 223–231)
  - Added `applyInnerResolutions` function (lines 233–280)
  
- **Created**: `src/files/upload/uploadConflict.inner.test.ts`
  - 8 test cases covering all behavior paths

## Commit

```
26198b4 feat(files): resolve per-file conflicts inside a merged folder

Merge defers each file inside the folder to a second round: paths with no
counterpart land untouched, colliding ones get their own overwrite/keep-both/
skip decision. A colliding path with no decision is skipped rather than
silently accepted.
```

## Self-Review

✓ All test cases from brief implemented exactly as specified
✓ No deviations from required function signature
✓ Comments in English only
✓ Logic matches round 1 (applyUploadResolutions) patterns where appropriate
✓ Defensive behavior enforced: colliding path with no resolution → skipped, not silently accepted
✓ No unrelated refactoring or changes
✓ Vue-tsc and vitest validation green across all required test files

## Concerns

None. The implementation is minimal, focused, and all validation passes. Ready for integration.
