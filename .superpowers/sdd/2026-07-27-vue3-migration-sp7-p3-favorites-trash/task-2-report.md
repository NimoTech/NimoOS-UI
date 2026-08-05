# Task 2 Report: `trashAssetToPhoto` 纯函数移植

## Status: DONE

## Commits
- `0178d3a` feat(photos): trashAssetToPhoto 纯函数移植(回收站精简映射)

## Test Summary
- **RED**: 1 test file, 4 tests failed (function not found) ✓
- **GREEN**: 1 test file, 4 tests passed ✓
- **Full suite**: 240 test files, 1453 tests all passed ✓
- **Type check**: `pnpm exec vue-tsc --noEmit` clean ✓

## Implementation Details

### Files Created
1. `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/util/trashAssetToPhoto.ts` — Pure function + interface
2. `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/util/__tests__/trashAssetToPhoto.test.ts` — Test suite (4 cases)

### Faithfulness to Vue 2 Source
Implementation **逐字匹配** Vue 2 `photos.js:191-213` logic:
- ✓ `daysLeft = Math.max(0, retention - Math.floor((now - deletedAt) / 86400000))`
- ✓ `from = parts.length >= 2 ? parts[parts.length - 2] : 'NAS'` (originalPath 倒数第二段)
- ✓ `sizeMb = (fileSize / (1024 * 1024)).toFixed(1)`
- ✓ `title = originalName.replace(/\.[^/.]+$/, '')` (去扩展名)
- ✓ No `originalName` → `title = id`
- ✓ Video detection: `mimeType.startsWith('video/')`

### Test Coverage
Four test cases verify:
1. **Normal case** (7 days elapsed, 30-day retention → 23 days left) + type conversions
2. **Overflow handling** (超期 daysLeft 钳到 0)
3. **Missing deletedAt** (默认 daysLeft=retention, from='NAS', video判定)
4. **Missing originalName** (title 回退到 id)

### Concerns: None
- No deviations from spec or Vue 2 source
- All type safety verified by TypeScript strict mode
- No side effects or dependencies

## Evidence

### RED Output
```
Error: Failed to resolve import "../trashAssetToPhoto" from "src/photos/util/__tests__/trashAssetToPhoto.test.ts".
Does the file exist?
```

### GREEN Output
```
Test Files  1 passed (1)
Tests  4 passed (4)
Duration  513ms
```

### Full Test Suite
```
Test Files  240 passed (240)
Tests  1453 passed (1453)
Duration  44.74s
```

### Type Check
```
(no output = clean)
```

---
