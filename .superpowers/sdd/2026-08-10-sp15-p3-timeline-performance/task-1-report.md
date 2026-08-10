# Task 1 Report: Service Layer Timeline & Trash Methods

## What Was Implemented

Added three service layer methods to `packages/service/src/photos.ts` to support SP15-P3 (photos timeline performance line):

1. **`getTimelineBuckets(): Promise<unknown>`**
   - Hits `/photos/timeline/buckets` endpoint with no params
   - Returns bare camelCase array from backend (no envelope)
   - Provides the "cheap half" of timeline: month-level directory

2. **`getTimelineBucket(year: number, month: number, limit = 500, offset = 0): Promise<unknown>`**
   - Hits `/photos/timeline/bucket` endpoint with `{ year, month, limit, offset }` params
   - Default limit is 500 (the backend's hard cap and honest default)
   - Year and month must be zero together for unknown-date bucket (backend validates)

3. **`listTrash(limit = 0, offset = 0): Promise<unknown[]>`**
   - Modified existing endpoint to accept optional pagination params
   - Mirrors `listFavorites` shape: only includes limit/offset in params when `limit > 0`
   - When omitted, lets backend apply its own default (500, per NimoOS-Photos#54)

## TDD Evidence

### Step 1-2: RED (Failing Tests)

Command: `pnpm test packages/service/src/photos.test.ts`

```
 FAIL  packages/service/src/photos.test.ts > createPhotos > getTimelineBuckets hits the bucket directory endpoint with no params
TypeError: p.getTimelineBuckets is not a function

 FAIL  packages/service/src/photos.test.ts > createPhotos > getTimelineBucket passes year/month/limit/offset
TypeError: p.getTimelineBucket is not a function

 FAIL  packages/service/src/photos.test.ts > createPhotos > getTimelineBucket defaults to the backend page cap and offset 0
TypeError: p.getTimelineBucket is not a function

 FAIL  packages/service/src/photos.test.ts > createPhotos > listTrash omits paging params when limit is 0 and passes them when set
AssertionError: expected undefined to deeply equal {}
  ❯ packages/service/src/photos.test.ts:70:29

Test Files  1 failed (1)
Tests  4 failed | 20 passed (24)
```

**Expected failures:**
- First three tests fail because methods don't exist
- Fourth test fails because `listTrash()` currently sends undefined params instead of empty object `{}`

### Step 4: GREEN (Passing Tests)

Command: `pnpm test packages/service/src/photos.test.ts`

```
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments

 Test Files  1 passed (1)
      Tests  24 passed (24)
   Start at  20:00:39
   Duration  752ms (transform 245ms, setup 353ms, import 35ms, tests 12ms, environment 235ms)
```

All 4 new tests now pass; all existing 20 tests remain green.

### Type Check

Command: `pnpm exec vue-tsc --noEmit`

Result: No output, no errors. All TypeScript checks pass.

## Files Changed

1. **`packages/service/src/photos.ts`**
   - Added 15 lines: `getTimelineBuckets()` + `getTimelineBucket()` after `getTimeline()` (line 29)
   - Modified 5 lines: `listTrash()` signature and implementation (line 455)
   - Added 5 comment lines explaining design rationale
   - Total: 50 insertions, 2 deletions

2. **`packages/service/src/photos.test.ts`**
   - Added 28 test lines (4 new test cases):
     - `getTimelineBuckets` endpoint validation
     - `getTimelineBucket` param passing
     - `getTimelineBucket` default values (limit=500, offset=0)
     - `listTrash` conditional params behavior
   - Total: 28 insertions, 0 deletions

## Self-Review Findings

✅ **Implementation matches brief exactly:**
- Method signatures are correct (all return `Promise<unknown>` as per existing idiom)
- Comments explain design intent in English
- Test cases assert real behavior, not mock internals
- Tests validate:
  - Correct HTTP method and URL
  - Correct params passed (and when omitted)
  - Correct response handling

✅ **TDD process followed:**
- Tests written first and confirmed failing
- Implementation added to make all tests pass
- Type checker confirms no regressions
- Tests remain pristine (no modifications after implementation)

✅ **Code quality:**
- Follows existing patterns in the file (matching `listFavorites` / `listAssets`)
- Comment style consistent with surrounding code
- No unnecessary type casting or envelope handling beyond what backend requires
- English comments and test descriptions per spec

## Concerns

None. Implementation is complete, tested, and typed. Ready for integration by downstream tasks (UI consumption in SP15-P2/P3).

---

## Commit

```
8639360 feat(photos): add the bucketed timeline endpoints and trash paging params
```

This task adds only the HTTP surface layer. The backend endpoints are already deployed and live on the device. No consuming code exists yet; that arrives in later UI tasks.
