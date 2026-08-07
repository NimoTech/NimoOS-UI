# Task 7 Report: 上传(multipart + uploads list/cancel)+ sprite 元数据 + 收尾回归

## Status: COMPLETED ✓

---

## Implementation Summary

### Files Changed
- **Modified:** `src/photos.ts` — added 7 new methods to the object returned by `createPhotos(http, getToken)`
- **Created:** `src/photos.uploads.test.ts` — 5 test cases covering upload & sprite functionality

### Methods Implemented

1. **uploadAsset(formData: FormData)** — POST multipart to `/photos/assets/upload`
2. **uploadAssetWithProgress(formData, onProgress?)** — Same with `Math.round(loaded/total*100)` progress callback; skips callback if `e.total` missing
3. **listUploads(status = 'active')** — GET `/photos/uploads` with params, returns `loose<unknown[]>()`
4. **cancelUpload(id)** — POST `/photos/uploads/{id}/cancel`
5. **spriteMeta(id)** — GET `/photos/assets/{id}/sprite` with `responseType: 'blob'`, parses lowercase headers (`x-sprite-frames`, `x-sprite-duration-ms`, `x-sprite-frame-w`, `x-sprite-frame-h`) with `parseInt(..., 10)` and `'0'` fallback
6. **spriteUrl(id)** — Returns `/v1/photos/assets/{id}/sprite${tokenQ('?')}`
7. **previewUrl(id)** — Returns `/v1/photos/assets/{id}/preview${tokenQ('?')}`

---

## Test Results

### Service Test Suite
- **Test Files:** 28 passed
- **Tests:** 158 total (5 new + 153 existing)
- **Status:** ✅ ALL GREEN

### Service Build
- **Command:** `pnpm build`
- **Result:** ✅ Clean (tsc -p tsconfig.json with no errors)

### Consumer Regression (NimoOS-New-UI)
- **Test Files:** 214 passed
- **Tests:** 1,199 passed (file:../NimoOS-Service dependency tested)
- **Status:** ✅ ALL GREEN

---

## TDD Process

| Step | Status | Details |
|------|--------|---------|
| RED | ✅ | 5 tests in `photos.uploads.test.ts` all failed (methods not found) |
| GREEN | ✅ | Implemented 7 methods; 5 new tests pass; all 158 total tests pass |
| Refactor | ✅ | Reused existing `loose<T>()` and `tokenQ(sep)` — no duplication |

---

## Self-Review Checklist

- ✅ **Method signatures exact:** All 7 methods match brief spec
- ✅ **Progress math:** `Math.round(loaded/total*100)`, skips when `!e.total`
- ✅ **Header parsing:** `parseInt(h['x-sprite-...'] || '0', 10)` with fallback
- ✅ **Token integration:** Both URL generators use `tokenQ('?')`
- ✅ **Type consistency:** All methods return correct types; integrated into single factory
- ✅ **Test shapes:** Assertions cover method contracts and edge cases
- ✅ **No regressions:** Consumer suite (1,199 tests) fully green; no breaking changes

---

## Concerns

None. All requirements met:
- Multipart upload with progress tracking integrated
- Uploads list/cancel aligned with Vue2 API
- Sprite metadata with proper header parsing
- Full regression coverage in consumer
- No files modified outside Service worktree

---

## Commit

| SHA | Subject |
|-----|---------|
| **1398c43** | photos 域:multipart 上传/uploads 队列/sprite 元数据入共享通道,P0 收官 |

---

## Files Changed

```
src/photos.ts                      +41 lines (7 new methods)
src/photos.uploads.test.ts         +68 lines (5 test cases)
```

---

**Report Date:** 2026-07-23  
**Task Duration:** P0 complete with all 7 tasks green; final regression verified  
**Consumer Impact:** Zero — 1,199 tests passing in NimoOS-New-UI
