# Task 3 Report: `applyUploadResolutions` Implementation

## What Was Implemented

Implemented `applyUploadResolutions` function and supporting types in `src/files/upload/uploadConflict.ts`:

**Exports added:**
- `AcceptedEntry` interface: Represents a single entry with per-entry upload policy
- `ApplyResult` interface: Result object with accepted entries and counts
- `nextAvailableName(name: string, existingNames: Set<string>): string`: Computes next available name with suffix
- `applyUploadResolutions(entries, resolutions, existingNames): ApplyResult`: Main function applying conflict resolutions

**Key implementation details:**
1. `existingNames` set is mutated: each folder group's newly chosen name is added immediately to prevent collisions between same-named folder groups in one batch
2. A non-mergeable `'merge'` action falls through to `keep_both` branch (only reachable via "apply to all" propagating onto type-mismatch collision)
3. Skipped and cancelled groups are dropped before batch manifest is reported
4. File groups with `keep_both` defer naming to backend via `'rename'` policy
5. Folder groups with `keep_both` rename top segment client-side and claim new name in shared set

**Import statement updated** to include `ConflictResolution` and `ConflictAction` types from `./fileConflict`.

## TDD Evidence

### RED (Step 2)
Ran: `pnpm exec vitest run src/files/upload/uploadConflict.apply.test.ts`

Result: 11 tests failed with expected error:
```
TypeError: nextAvailableName is not a function
TypeError: applyUploadResolutions is not a function
```

### Implementation (Step 3)
Added implementation code to `uploadConflict.ts` with:
- Updated import statement
- `AcceptedEntry` interface (with optional `pendingInnerCheck` field for merge)
- `ApplyResult` interface
- `nextAvailableName` function with suffix generation logic
- `applyUploadResolutions` function with full resolution application logic

### GREEN (Step 4)
Ran: `pnpm exec vitest run src/files/upload/uploadConflict.apply.test.ts src/files/upload/uploadConflict.group.test.ts`

Result: **24 tests passed** (11 new tests + 13 from Task 2)

## Test Results Summary

```
Test Files  3 passed (3)
     Tests  34 passed (34)
   Start at  01:22:58
   Duration  2.83s (transform 1.76s, setup 3.03s, import 318ms, tests 150ms, environment 3.42s)
```

Test breakdown:
- `fileConflict.test.ts`: 10 tests PASS
- `uploadConflict.group.test.ts`: 13 tests PASS
- `uploadConflict.apply.test.ts`: 11 tests PASS

All tests cover the critical behavior:
1. `nextAvailableName` returns unchanged name when free, appends smallest free (n) suffix
2. No-resolution entries land with empty policy
3. Skip/cancelled groups properly counted separately and dropped
4. Overwrite stamps correct policy
5. File keep_both defers to backend via 'rename'
6. Folder keep_both rewrites all entries to new top name
7. Two keep_both folder groups do not collide (existingNames mutation verified)
8. Merge on mergeable folder tags for second round with `pendingInnerCheck`
9. Non-mergeable merge degrades to keep_both (fallthrough logic verified)

## Type Checking

Ran: `pnpm exec vue-tsc --noEmit`

Result: **Clean** — no type errors

## Files Changed

1. **Modified:** `src/files/upload/uploadConflict.ts`
   - Updated import statement to include `ConflictResolution`, `ConflictAction`
   - Added `AcceptedEntry` interface
   - Added `ApplyResult` interface
   - Added `nextAvailableName()` function
   - Added `applyUploadResolutions()` function

2. **Created:** `src/files/upload/uploadConflict.apply.test.ts`
   - 11 test cases covering both functions

## Commit

```
21ff569 feat(files): turn conflict choices into per-entry upload policies

Skipped and cancelled groups are dropped before the batch manifest is
reported, so reconciliation never counts them as missing. Keep-both on a
folder renames the top segment client-side and claims the new name in the
shared set, so two same-named folder groups in one batch cannot collide.
```

## Self-Review Findings

✅ **Code quality:**
- All comments in English
- Implementation matches brief exactly
- Two subtle requirements preserved:
  1. `existingNames` is mutated (verified by test case at line 87-92)
  2. Non-mergeable merge falls through to keep_both (verified by test case at line 105-116 and implementation comment at line 196-198)

✅ **Test coverage:**
- All 11 test cases from brief are comprehensive
- Tests verify real behavior, not just happy path
- Mutation behavior tested explicitly ("two keep_both folder groups")
- Fallthrough behavior tested with clear scenario description

✅ **No stray warnings:**
- vue-tsc clean
- vitest runs clean with no warnings
- All 34 tests passing

✅ **No unrelated changes:**
- Only modified uploadConflict.ts and created uploadConflict.apply.test.ts
- No refactoring, only new functionality

## Concerns

None identified. Implementation is complete and verified.

