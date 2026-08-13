# Task 3 Report: Reset folder sizes on every listing load

## Summary

Successfully wired the files store's `load()` function to reset the folder-size cache on every directory listing load. This ensures computed folder sizes never leak between views.

## Changes Made

### src/files/stores/files.ts
- **Added import:** `import { useFolderSizesStore } from './folderSizes'` (line 5)
- **Modified `load()` function:** Added call to `useFolderSizesStore().reset()` immediately after `clearSelection()` (lines 69-71)
- Added explanatory comment documenting the epoch guard mechanism

### src/files/stores/files.test.ts
- **Updated mock factory:** Added `getFolderSize: vi.fn(async () => 4096)` to the `folder` object in the `@nimotech/nimoos-service` mock (line 15)
- **Added test case:** New test "load resets folderSizes so computed sizes never survive a listing reload" that:
  - Calls `compute()` to populate a folder size (status = 'done')
  - Calls `files.load()` to simulate a directory navigation
  - Verifies the status has been reset to 'idle'

## Test Results

```
Test Files  1 passed (1)
     Tests  13 passed (13)
```

All tests pass, including:
- 12 pre-existing tests (unchanged behavior)
- 1 new test validating the reset behavior

### Test command:
```bash
pnpm exec vitest run src/files/stores/files.test.ts
```

## Implementation Details

The reset happens at the exact right moment in the control flow:
- `load()` is called for all directory listing operations (navigation, refresh, post-file-op reload)
- `clearSelection()` is called first (existing behavior for per-directory state cleanup)
- `useFolderSizesStore().reset()` is called second (new behavior for cache invalidation)
- This one hook covers every moment the directory contents may have changed

The epoch guard in `folderSizes.ts` ensures that any in-flight computations from the previous view are silently dropped on reset, preventing race conditions.

## Commit

```
Hash: 81808774
Message: feat(files): clear computed folder sizes on every listing load

Navigation, refresh and post-operation reloads all go through
filesStore.load(), so one reset hook covers every moment the
directory contents may have changed.

Signed-off-by: Tiansanchuan <1312528051@qq.com>
```

## Concerns

None. The implementation exactly matches the spec, follows the TDD order specified in the brief, and all tests pass.
