# Task 2 Completion Report: `folderSizes` Pinia Store with Epoch-Guarded Async Writes

## Summary
Successfully implemented a Pinia store (`useFolderSizesStore`) for on-demand folder size computation with epoch-guarded stale-write protection. All 6 test cases pass.

## Files Created
1. **`src/files/stores/folderSizes.ts`** (53 lines)
   - Pinia setup store with id `'files-folder-sizes'`
   - Exports: `FolderSizeStatus`, `FolderSizeState`, `useFolderSizesStore()`
   - Implements: `statusOf()`, `bytesOf()`, `compute()`, `reset()`
   - Epoch counter guards against stale writes after `reset()`

2. **`src/files/stores/folderSizes.test.ts`** (90 lines)
   - 6 comprehensive test cases covering all behaviors
   - Mocks `@nimotech/nimoos-service` folder API
   - Uses deferred promise utility for async control

## Implementation Details

### Store Structure
- **`states`**: `Record<string, FolderSizeState>` — per-path loading/done/error state with optional byte count
- **`epoch`**: Counter bumped on `reset()` to guard against stale writes
- **`statusOf(path)`**: Returns `'idle' | 'loading' | 'done' | 'error'` (undefined entries map to `'idle'`)
- **`bytesOf(path)`**: Returns `bytes` from state or `undefined`
- **`compute(path)`**: Initiates folder size fetch; no-op if already loading/done; retries on error
- **`reset()`**: Clears all state and increments epoch

### Key Design: Epoch Guard
The epoch counter implements the repo's stale-write guard requirement:
1. Before async fetch, capture current `epoch` value
2. After fetch completes (success or error), check if epoch changed
3. If changed (reset happened), silently drop the result
4. This prevents slow walks from overwriting newer directory listings

### Test Coverage
1. ✅ **Happy path**: compute resolves to `'done'` with byte count
2. ✅ **Deduplication**: no second request while loading; cached after done
3. ✅ **Error retry**: failed state resets to idle, compute retries on next call
4. ✅ **Epoch guard (success)**: stale response after reset is dropped
5. ✅ **Epoch guard (error)**: stale error after reset is dropped
6. ✅ **Reset clears all**: multiple paths cleared by single reset

## Test Execution

### Initial Run (Step 2)
```
Exit code 1
FAIL: "Error: Failed to resolve import "./folderSizes" from "folderSizes.test.ts""
```
Expected failure — module did not exist.

### Final Run (Step 4 & Verification)
```
Test Files  1 passed (1)
Tests       6 passed (6)
Duration    2.38s
```

All tests pass without errors. The console.warn output for the error test case is expected behavior (error logging).

## Code Quality

### Comments & Strings
- ✅ All comments in English
- ✅ All error/log strings in English
- ✅ Store function names and exports descriptive

### Adherence to Requirements
- ✅ Consumes `service.folder.getFolderSize(path): Promise<number>` from Task 1
- ✅ Exposes `useFolderSizesStore()`, `states`, `statusOf()`, `bytesOf()`, `compute()`, `reset()`
- ✅ Implements epoch-guarded async write pattern per repo guidelines
- ✅ Zero modifications outside the two created files
- ✅ Follows TDD order: tests → implementation → passing verification

## Commit Details
```
commit d66023734f3bf6c8cabd165f24082be6fb9b9132
Author: Tiansanchuan <1312528051@qq.com>
Date:   Thu Aug 13 10:21:37 2026 +0800

feat(files): add folderSizes store for on-demand folder size

Per-path loading/done/error state keyed to the current directory
listing. An epoch counter drops responses that resolve after a
listing reload, so a slow walk can never write into a newer view.

Signed-off-by: Tiansanchuan <1312528051@qq.com>
```

### Changed Files
- `src/files/stores/folderSizes.ts` (new, 53 lines)
- `src/files/stores/folderSizes.test.ts` (new, 90 lines)

## No Concerns
- Implementation matches the brief exactly
- All tests pass on first run after implementation
- No stray changes outside scope
- English-only code and comments
- DCO sign-off included in commit

## Next Steps
Task 2 is complete and ready. The store is available for Task 3 (component integration) and Task 4 (rendering).
