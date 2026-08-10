# Task 2 Report: `timelineBuckets.ts` Pure Functions

**Status:** DONE

**Commit:** `bdee7d2` — feat(photos): add the bucket key, title and staleness helpers

---

## What Was Implemented

Created the bucket data layer for SP15-P3 timeline pagination:

### Files Created
1. **`src/photos/util/timelineBuckets.ts`** (85 lines)
   - `BucketMeta` interface: `{ year, month, count, videoCount }`
   - `bucketKey(b)`: Delegates to `groupToMonth` to ensure key consistency with the legacy timeline path
   - `parseBucketKey(key)`: Inverse parser supporting `'YYYY-MM'` format and special `'unknown'` key
   - `normalizeBuckets(raw)`: Coerces backend directory response into typed `BucketMeta[]` with safety for null/invalid data
   - `bucketToMonth(b, photos)`: Converts bucket metadata to a `Month` object with intersection type `{ loaded, count, videoCount }` (fields owned by Task 6)
   - `staleBucketKeys(prev, next, loadedKeys)`: Cache invalidation rule—only stales buckets that were loaded AND changed (count or videoCount)

2. **`src/photos/util/__tests__/timelineBuckets.test.ts`** (82 lines)
   - 15 test cases organized in 5 describe blocks
   - Tests for key round-tripping, unknown bucket handling, junk-key rejection
   - Tests for normalization safety (null, non-array, missing fields, type coercion)
   - Tests for Month generation (loaded state, count/videoCount preservation)
   - Tests for staleness rules (count change, vanished bucket, unchanged bucket, videoCount-only change, never-loaded bucket)

---

## TDD Evidence

### Step 2: RED (Confirmed Failure)

**Command:** `pnpm test src/photos/util/__tests__/timelineBuckets.test.ts 2>&1`

**Output:**
```
FAIL  src/photos/util/__tests__/timelineBuckets.test.ts
Error: Failed to resolve import "../timelineBuckets" from "src/photos/util/__tests__/timelineBuckets.test.ts". 
Does the file exist?
```

**Why Expected:** Module does not exist yet; import resolution fails.

---

### Step 4: GREEN (All Tests Pass)

**Command:** `pnpm test src/photos/util/__tests__/timelineBuckets.test.ts 2>&1`

**Output:**
```
Test Files  1 passed (1)
     Tests  15 passed (15)
 Start at  20:05:43
 Duration  679ms (transform 218ms, setup 305ms, import 33ms, tests 8ms, environment 225ms)
```

**All 15 tests pass with no failures.**

**Type Check Command:** `pnpm exec vue-tsc --noEmit 2>&1`

**Output:** (no output = no type errors)

---

## Test Coverage Summary

All assertions verified:

1. **bucketKey / parseBucketKey (4 tests)**
   - ✅ Key format matches `groupToMonth` exactly (both normal and unknown buckets)
   - ✅ Round-trips `'2026-08'` ↔ `{ year: 2026, month: 8 }`
   - ✅ Parses `'unknown'` to `{ year: 0, month: 0 }` (zero PAIR, not half-zero)
   - ✅ Rejects invalid keys (`'search'`, `''`, `'2026-13'`) as null

2. **normalizeBuckets (3 tests)**
   - ✅ Preserves backend order and coerces missing `videoCount` to 0
   - ✅ Tolerates null and non-array bodies (returns `[]`)
   - ✅ Drops entries missing or type-invalid `year`/`month`

3. **bucketToMonth (3 tests)**
   - ✅ Null photos → `loaded: false`, empty array `photos`
   - ✅ Empty array photos → `loaded: true` (distinguishes "not fetched" from "empty")
   - ✅ Photos array passed through untouched

4. **staleBucketKeys (5 tests)**
   - ✅ Invalidates loaded bucket with changed count
   - ✅ Invalidates loaded bucket that vanished
   - ✅ Leaves unchanged bucket byte-identical
   - ✅ Invalidates on `videoCount`-only change
   - ✅ Ignores never-loaded buckets

---

## Self-Review

### Correctness
- ✅ **bucketKey** delegates to `groupToMonth` without reimplementing MONTH_NAMES
- ✅ **parseBucketKey** correctly:
  - Parses `'YYYY-MM'` with month range [1..12]
  - Handles unknown bucket as zero PAIR (not half-zero)
  - Rejects invalid formats/values as null
- ✅ **normalizeBuckets** safely handles all edge cases (null, non-array, missing fields, type mismatches)
- ✅ **bucketToMonth** uses intersection type `Month & { loaded, count, videoCount }` (not modifying Month interface per brief)
- ✅ **staleBucketKeys** implements the spec:
  - Only checks buckets in `loadedKeys` (prevents false invalidation of never-loaded buckets)
  - Invalidates on count change (both total and video)
  - Invalidates on vanish (bucket removed from next)
  - Leaves unchanged buckets byte-identical

### Assertion Quality
- ✅ `groupToMonth` equality assertions verify key consistency (lines 34, 36)
- ✅ Zero-pair parse assertion confirms `{ year: 0, month: 0 }` not half-zero (line 44)
- ✅ Junk-key rejection assertions test multiple invalid formats (lines 47-49)
- ✅ Each staleness rule has independent test case with clear preconditions

### Test Execution
- ✅ 15/15 tests pass
- ✅ No type errors (vue-tsc clean)
- ✅ No noise (jsdom "Not implemented: navigation" warnings are known non-defects per task brief)

### Code Quality
- ✅ All code comments in English
- ✅ Test descriptions in English
- ✅ No color/CSS involved (not applicable to this data layer)
- ✅ No additional files created outside `src/photos/**`
- ✅ Helper functions (`intOr`) properly scoped as private (no export)
- ✅ Regex for parsing uses safe bounds checking (month 1..12)

---

## Files Changed

```
src/photos/util/timelineBuckets.ts (NEW)
  - 85 lines
  - 6 exports: BucketMeta, bucketKey, parseBucketKey, normalizeBuckets, bucketToMonth, staleBucketKeys
  - 1 private helper: intOr

src/photos/util/__tests__/timelineBuckets.test.ts (NEW)
  - 82 lines
  - 15 test cases in 5 describe blocks
  - Helper: B() factory for test data
```

---

## Concerns

**None.** Implementation follows the brief exactly. All tests pass. Type checking clean.

---

## Dependencies & Integration Notes

- ✅ Module imports `groupToMonth`, `Month`, `Photo` from `assetToPhoto.ts` (verified exports exist)
- ✅ No circular dependencies (this module is pure, consumes only types and `groupToMonth`)
- ✅ Ready for Task 4/5 (store integration) and Task 6 (Month interface field additions)
- ✅ Open-source manifest: `src/photos/**` already covered by one directory entry—no new registration needed

---

**Next Task:** Task 3 (build real backend HTTP layer if not already done) or Task 4 (Pinia store integration).
