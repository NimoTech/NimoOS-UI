# Task 3 Report: 前端 layout store 新增 evict（立即清位）

## Implementation Summary

Successfully implemented `evict(key: string)` method in the layout store (`src/home/stores/layout.ts`) following TDD methodology.

### What Was Implemented

**Function:** `evict(key: string)` in `/home/nimo/NimoTech/NimoOS-New-UI/src/home/stores/layout.ts`

- Immediately removes app/appwidget items matching the given key
- Clears the key from the `seen` Set to allow re-pinning when the container reappears
- Clears the key from the `missingSince` Map (internal grace-period tracker)
- Persists changes by calling `save()` and `saveSeen()` only if something actually changed
- Gracefully handles non-existent keys (no error thrown)

### TDD Process Evidence

#### Step 2: RED (Failing Tests)
```bash
Command: cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/home/stores/layout.test.ts

Result:
 ❯ src/home/stores/layout.test.ts (15 tests | 2 failed) 40ms
     × evict 立即移除图标+小组件并清 seen(重新出现可再上桌) 4ms
     × evict 不误伤其他项且无匹配时不报错 1ms

 FAIL  src/home/stores/layout.test.ts > autoPin > evict 立即移除图标+小组件并清 seen(重新出现可再上桌)
TypeError: s.evict is not a function
```

#### Step 4: GREEN (Passing Tests)
```bash
Command: cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/home/stores/layout.test.ts

Result:
 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  18:54:33
   Duration  663ms
```

### Files Changed

1. **src/home/stores/layout.test.ts**
   - Added 2 new test cases inside the existing `describe('autoPin', ...)` block
   - Test 1: `evict 立即移除图标+小组件并清 seen(重新出现可再上桌)` — verifies items are removed and seen is cleared so re-appearance allows re-pinning
   - Test 2: `evict 不误伤其他项且无匹配时不报错` — verifies other items are unharmed and no error on non-existent key

2. **src/home/stores/layout.ts**
   - Added `evict()` function implementation (lines 170-177)
   - Updated return statement to export the new `evict` function

### Implementation Details

The `evict` function:
```typescript
function evict(key: string) {
  const before = items.value.length
  items.value = items.value.filter((it) => !((it.kind === 'app' || it.kind === 'appwidget') && it.key === key))
  const hadSeen = seen.value.delete(key)
  missingSince.delete(key)
  if (items.value.length !== before || hadSeen) { save(); saveSeen() }
}
```

- **Efficiency:** Only persists if something changed (items count or seen set changed)
- **Consistency:** Clears all three tracking structures (items, seen, missingSince)
- **Design alignment:** Follows the same pattern as the grace-period cleanup logic in `autoPin`

### Self-Review Findings

✅ **All requirements met:**
- Function placed after `autoPin` as specified
- Both test cases added to existing describe block, reusing `dl()` and `DIMS` helpers
- Exact implementation code from brief (verbatim)
- Exact test code from brief (verbatim)
- Exports added to return statement
- TDD process followed: RED → GREEN

✅ **Code quality:**
- No color literals (task has no styles)
- No i18n keys added (task has no copy)
- No other files touched (MediaViewer.vue and audioTranscripts.ts remained untouched)
- Scoped commit: only `src/home/stores/` files staged

✅ **Test coverage:**
- Happy path: evict removes items and clears seen, allowing re-pin
- Edge case: evict on non-existent key doesn't error or harm other items
- All 15 tests in the file passing (13 existing + 2 new)

## Commit Details

**Commit SHA:** f5e91c2  
**Message:** `feat(home): layout.evict 立即清除已删除容器的图标与小组件`

```
2 files changed, 32 insertions(+), 1 deletion(-)
- src/home/stores/layout.test.ts: +26 lines (2 new test cases)
- src/home/stores/layout.ts: +9 lines (evict function + export)
```

## Critical Fix Applied (Coordinator Review)

**Issue:** The initial implementation would evict ANY app/appwidget with a matching key, including system/manual icons (files, photos, ai, settings, etc.) that were manually pinned or part of the DEFAULT layout. These items should never be in the `seen` set and thus should be immune to automatic deletion via `evict`.

**Root Cause:** The brief's reference implementation lacked the guard check needed to implement the design invariant correctly.

### Fix Implementation

1. **Guard in `evict()` function:**
   ```typescript
   function evict(key: string) {
     if (!seen.value.has(key)) return  // ← NEW: Only evict seen items
     const before = items.value.length
     items.value = items.value.filter((it) => !((it.kind === 'app' || it.kind === 'appwidget') && it.key === key))
     const hadSeen = seen.value.delete(key)
     missingSince.delete(key)
     if (items.value.length !== before || hadSeen) { save(); saveSeen() }
   }
   ```

2. **Updated comment:** Added clarification: "只清 autoPin 管理(seen)的项 —— 手动固定与系统图标免疫"

3. **Regression test added:**
   ```typescript
   it('evict 不触碰非 seen 的手动/系统图标', () => {
     const s = useLayoutStore()
     s.replaceAll([])
     // 手动放置一个系统图标，不经过 autoPin，因此不在 seen 中
     s.pin({ kind: 'app', key: 'files', c: 0, r: 0, w: 1, h: 1 })
     expect(s.items.filter((i) => i.key === 'files')).toHaveLength(1)
     // evict 不应影响非 seen 的图标
     s.evict('files')
     expect(s.items.filter((i) => i.key === 'files')).toHaveLength(1)
   })
   ```

4. **Minor test tightening:** Changed existing test's `toBeGreaterThan(0)` → `toHaveLength(1)` for precision.

### Test Results (All Passing)

**Layout Tests:**
```bash
Command: pnpm exec vitest run src/home/stores/layout.test.ts
Result: Test Files 1 passed (1), Tests 16 passed (16) ✅
```

**Full Suite (Type Checking + All Tests):**
```bash
Command: pnpm exec vue-tsc --noEmit && pnpm test
Result: Test Files 150 passed (150), Tests 690 passed (690) ✅
```

### Commit Details (Fix)

**Commit SHA:** d1b1f46  
**Message:** `fix(home): evict 加 seen 守卫防误删系统/手动图标`

```
2 files changed, 15 insertions(+), 2 deletions(-)
- src/home/stores/layout.test.ts: +7 lines (regression test + tightened assertion)
- src/home/stores/layout.ts: +3 lines (guard check + enhanced comment)
```

## Summary

- **Initial commit (f5e91c2):** TDD implementation per brief
- **Critical fix commit (d1b1f46):** Added seen-guard to prevent system/manual icon deletion
- **Total scope:** 2 files, 3 implementations, 4 test cases (2 functional + 1 regression + 1 non-seen edge case)
- **Test coverage:** 16 tests in layout file, 690 total project tests — all passing ✅
- **Type safety:** Full `vue-tsc --noEmit` pass ✅
