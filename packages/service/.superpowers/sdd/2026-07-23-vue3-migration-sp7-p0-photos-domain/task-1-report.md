# Task 1 Report: photos 域核心块 + URL 生成器统一 token

## Status
✅ DONE

## Summary
Successfully implemented the core photos module with:
- Module-level `loose<T>(d: unknown): T` helper for dual-form response unpacking
- Factory-closure `tokenQ(sep)` function for unified token query string generation
- All 14 core methods: asset operations, config management, storage/status/tasks, cache/index operations
- Backward-compatible with existing 4 methods while updating token URL convention

## Implementation Details

### Files Changed
1. **`src/photos.ts`** — Complete rewrite (205 lines)
   - Added `loose()` module function
   - Added `tokenQ()` closure inside `createPhotos()` factory
   - Implemented all 14 new methods: `getAsset`, `getAssetOcr`, `deleteAsset`, `getConfig`, `updateConfig`, `getStorage`, `getAbout`, `getStatus`, `listTasks`, `pruneCache`, `rebuildIndex`, `triggerScan`, `liveUrl`
   - Updated `originalUrl()` to use unified token via `tokenQ('?')`
   - Updated `thumbnailUrl()` to use `tokenQ('&')` via closure

2. **`src/photos.test.ts`** — Extended (97 lines)
   - Added `capture()` mock helper for HTTP call introspection
   - Added 15 new test cases in "photos 核心块" describe block
   - Updated existing `originalUrl` test to verify token append
   - All existing tests preserved and passing

### TDD Evidence

**RED Phase:**
```bash
$ pnpm vitest run src/photos.test.ts
# Result: 15 FAILED
# - "getAsset is not a function"
# - "originalUrl builds the original path" (expects token, got no token)
# - Missing: getAssetOcr, deleteAsset, updateConfig, getConfig, getStorage, getAbout, getStatus, listTasks, pruneCache, rebuildIndex, triggerScan, liveUrl
```

**GREEN Phase:**
```bash
$ pnpm vitest run src/photos.test.ts
# Result: 19 PASSED (19 tests)
Test Files: 1 passed (1)
Tests: 19 passed (19)
```

**Full Suite Verification:**
```bash
$ pnpm test
# Result: All 131 tests PASSED across 22 files
Test Files: 22 passed (22)
Tests: 131 passed (131)
```

**Type Check:**
```bash
$ pnpm build
# Result: No TypeScript errors
```

## Self-Review Checklist

✅ **Completeness**
- All 14 new methods implemented with exact signatures from brief
- Module-level `loose<T>()` function defined
- Factory-closure `tokenQ()` defined inside `createPhotos()`
- Existing 4 methods preserved (listAssets, getTimeline, thumbnailUrl, originalUrl)
- New method `liveUrl()` added

✅ **Quality**
- Names match brief exactly: `loose`, `tokenQ`, `getAsset`, `getAssetOcr`, etc.
- Token handling unified via `tokenQ()` closure:
  - `?` separator for `originalUrl` and `liveUrl`
  - `&` separator for `thumbnailUrl` (already has `?size=...`)
  - No token appended when `getToken()` returns null
  - Proper `encodeURIComponent()` for special characters (e.g., `T&1` → `T%261`)

✅ **Discipline**
- No extra features; implementation follows brief exactly
- YAGNI maintained: only added what was specified
- Uses existing `unwrap()` and `loose()` helpers for response unpacking
- Comment added for `updateConfig()` extra fields behavior

✅ **Testing**
- TDD followed: write failing tests → verify RED → implement → verify GREEN
- All test cases from brief added:
  - Individual method tests (getAsset, getAssetOcr, deleteAsset)
  - Batch test with `it.each()` for config/status/tasks/cache/index/scan
  - Error envelope handling (success !== 200 throws)
  - Token presence/absence in URLs
  - Selective field inclusion in updateConfig body
- No stray warnings; clean test output
- Existing tests updated to new token convention and preserved

✅ **Conventions**
- Followed repo conventions:
  - TypeScript NodeNext with `.js` import suffixes
  - vitest test colocated in `.test.ts`
  - Mock object pattern from `disks.test.ts`
  - Comments in Chinese per brief
  - Co-authored commit with Claude Fable 5

## Commits Created
- **701b521** - `photos 域核心块:assets/config/storage/status/tasks + 媒体 URL 统一 token 口径`

## Test Results Summary
- **photos.test.ts**: 19/19 passed ✅
- **Full suite**: 131/131 passed ✅
- **Type check**: No errors ✅

## Concerns
None. Implementation complete, tested, and committed cleanly.
