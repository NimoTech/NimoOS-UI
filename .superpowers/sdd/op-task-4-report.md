# Task 4 Report: 前端 panelMap 路由 (TDD)

**Status:** DONE

**Commit:** `7b94179` — feat(files-viewer): 旧版 Office(doc/wps/xls/ppt/pptx)路由到 PDF 查看器(转换),xls 出 excel

---

## Changes Summary

### Files Modified
1. `src/files/viewers/panelMap.ts`
2. `src/files/viewers/panelMap.test.ts`

### Mapping Changes

**From (before):**
- `'pdf-viewer'`: `APPLICATION_PDF` (only `['pdf']`)
- `'doc-viewer'`: `APPLICATION_VND_MS_WORD` (old: `['doc', 'docx', 'wps']`)
- `'excel-viewer'`: `APPLICATION_VND_MS_EXCEL` (old: `['xls', 'xlsx', 'csv']`)

**To (after):**
- `'pdf-viewer'`: `['pdf', 'doc', 'wps', 'xls', 'ppt', 'pptx']`
- `'doc-viewer'`: `['docx']`
- `'excel-viewer'`: `['xlsx', 'csv']`

### Import Changes
**Removed unused imports:** `APPLICATION_PDF`, `APPLICATION_VND_MS_WORD`, `APPLICATION_VND_MS_EXCEL`

**Preserved:** `union` helper, and all other category imports still in use by `code-editor`, `video-player`, `image-viewer`, `markdown`.

### Comment Update
Updated first-line comment to clarify:
- pdf-viewer covers native PDF + legacy Office formats needing backend conversion
- doc-viewer now only handles .docx (OOXML)
- All extension groups are disjoint; first-match behavior is valid

---

## TDD Evidence

### Step 1 & 2: RED State
Updated test file with three new test cases:
```ts
it('docx → doc-viewer; 旧版 doc/wps → pdf-viewer(转换)', () => { ... })
it('pdf + 旧版 ppt/pptx/xls → pdf-viewer', () => { ... })
it('新版 xlsx/csv → excel-viewer(不含 xls)', () => { ... })
```

**Test run output (RED):**
```
Test Files  1 failed (1)
Tests  3 failed | 8 passed (11)
```

Failures:
- `doc/wps` expected `pdf-viewer` but got `doc-viewer`
- `xls/ppt/pptx` expected `pdf-viewer` but got `excel-viewer`/`null`
- `xls` expected NOT `excel-viewer` but was `excel-viewer`

### Step 3 & 4: GREEN State

Updated `panelMap.ts` with new mapping (literal arrays, removed unused imports).

**Test run output (GREEN):**
```
Test Files  1 passed (1)
Tests  11 passed (11)
```

All tests now pass, including the three new ones.

---

## Full Test & Build Results

### Full Test Suite
```
Test Files  126 passed (126)
Tests  480 passed (480)
```

✓ All 480 tests pass (no regressions in other test files)

### Build (vue-tsc Check)
```
✓ built in 8.43s
```

✓ **No vue-tsc errors.** Build succeeds cleanly. Unused import removal was successful — no import-related errors.

---

## Self-Review

**What went right:**
1. Followed TDD discipline: RED → GREEN → verify
2. Test cases clearly articulate the new behavior (legacy Office → pdf-viewer)
3. Import cleanup was correct: removed only the three unused application/* categories
4. Comment update accurately describes the new routing logic
5. All 480 tests pass; no regressions
6. Build is clean (vue-tsc validates no unused imports)
7. Extension groups remain disjoint (first-match still valid)

**Concerns:** None

---

## Commit Details

- **Hash:** 7b94179
- **Message:** `feat(files-viewer): 旧版 Office(doc/wps/xls/ppt/pptx)路由到 PDF 查看器(转换),xls 出 excel`
- **Files:** 2 changed (17 insertions, 16 deletions)
  - `panelMap.ts`: import cleanup + mapping change + comment update
  - `panelMap.test.ts`: old word/excel/ppt cases replaced with new 3-case suite

---

## Verification Checklist

- [x] Step 1: Updated test cases (RED)
- [x] Step 2: Ran tests, confirmed RED (3 failures)
- [x] Step 3: Updated panelMap.ts mapping
- [x] Step 4: Ran tests, confirmed GREEN (all 11 pass)
- [x] Step 5: Committed both files with exact message
- [x] Full test suite passes (480/480)
- [x] Build succeeds (vue-tsc clean)
- [x] Unused imports removed (no typescript errors)
- [x] Extension groups disjoint; first-match valid
- [x] Comment updated per brief spec

