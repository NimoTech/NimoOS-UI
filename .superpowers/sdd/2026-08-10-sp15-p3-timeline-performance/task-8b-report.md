# Task 8b Report: 选择器与「最近 30 天建相册」在分桶模式下的空数据修复

## What was implemented

Bucket mode (SP15-P3) broke an invariant two consumers relied on: legacy `months.length === 0
→ fetch` guards assume "months present ⇒ allPhotos present", which is true on the legacy path
but false in bucket mode (the directory arrives before any bucket's photos do).

1. **`src/photos/stores/timeline.ts`** — added `fetchNewestBuckets(n: number): Promise<void>`.
   - No-op outside bucket mode (`!bucketMode.value`) and for `n <= 0` — the legacy path already
     has all photos after `fetchTimeline()`, so this must not change legacy behaviour at all.
   - Filters out the unknown-date bucket (`year === 0 && month === 0`) before taking the first
     `n` — that bucket sorts last and has no date semantics, so it must never count as "newest".
   - Fetches the selected buckets concurrently via `Promise.all`, delegating to the existing
     `fetchBucket(key)` for per-key dedup, paging, and "leave unloaded on failure".
   - Exported from the store's `return`.

2. **`src/views/PhotosAlbums.vue`** — restructured `confirmCreate()`'s `'recent'` branch:
   - Computing the "last 30 days" id set now happens *before* `createAlbum()` is ever called,
     not after. Previously the album was always created first, and if the id set turned out
     empty, `addAssetsToAlbum` was silently skipped while the success toast still fired.
   - Added `await timeline.fetchNewestBuckets(2)` right after the existing `months.length === 0
     → fetchTimeline()` guard — two buckets (current month + previous) always cover any 30-day
     window. This call is a no-op in legacy mode, so the legacy flow (already covered by 3
     pre-existing tests) is untouched.
   - New guard: if the computed id set is empty, no album is created and a failure toast
     (`photosAlbumCreateFailed`, an existing key — no new i18n key added) is shown instead of
     the success toast. This closes the "empty album + fake success toast" hole in *both*
     bucket mode (the new bug) and legacy mode (a pre-existing latent bug with the same shape,
     e.g. a brand-new install with zero photos anywhere).

3. **`src/photos/components/PhotosLibraryPicker.vue`** (per the 2026-08-11 owner ruling: "load
   the newest few months on open, page in earlier months as the user scrolls to the bottom"):
   - On open (`watch(() => props.open, ...)`), after the existing `months.length === 0 →
     fetchTimeline()` guard, added `await timeline.fetchNewestBuckets(3)`. **This had to be
     sequenced, not parallel** — see "TDD evidence" below for the bug this caught.
   - Added `onListScroll(e)`: when the scrolled container is within 200px of its bottom, finds
     the next unloaded dated bucket (skipping the unknown-date one) and calls
     `timeline.fetchBucket(key)`. A local `loadingMore` boolean caps it to one in-flight bucket
     load at a time, on top of `fetchBucket`'s own per-key dedup, so one scroll gesture cannot
     spray requests for a dozen different months before the first lands.
   - Attached `@scroll="onListScroll"` to `.lib-picker-body` — confirmed by reading the
     component's `<style scoped>` block that this div, not the outer `.lib-picker-panel` or
     `.lib-picker-overlay`, is the one with `overflow-y: auto` (line 318 of the pre-edit file).

No new files, no new i18n keys, no CSS changes, `PhotosGrid.vue` untouched.

## What was tested, with results

Ran the three named test files after every change, plus `vue-tsc`:

```
pnpm test src/photos/stores/__tests__/timeline.test.ts
  → 50 passed
pnpm test src/photos/components/__tests__/PhotosLibraryPicker.test.ts src/views/__tests__/PhotosAlbums.test.ts
  → 17 + 50 = 67 passed
pnpm exec vue-tsc --noEmit
  → clean, exit 0
```

Combined run of all three target files: 117 passed, 0 failed.

Full repo suite (`pnpm test`) run twice:
- **Before committing** (dirty working tree): 685/689 test files passed, 10973/11046 tests
  passed, 70 skipped. The 3 failing tests (in `oss/cli-args.test.mjs`) and 1 failing file
  (`oss/tree.test.mjs`, fails in `beforeAll`) are the OSS export suite's "working tree must be
  clean" guard tripping on this task's own uncommitted changes — every failure's own error
  output is literally `工作树不干净,导出中止` listing exactly the six files this task touched.
  Unrelated to Task 8b's logic.
- **After committing** (`e0ebbb2`): 688/689 test files passed, 11045/11046 tests passed. The
  OSS export guard failures are gone (clean tree now). The sole remaining failure —
  `src/home/components/DesktopContextMenu.test.ts > handles a right-click on blank canvas` — is
  explicitly listed in this task's "known non-defects, do not chase" list (an order-dependent
  flake unrelated to anything this task touches; the file lives under `src/home/`, nothing in
  scope here).

## TDD evidence

**Store action (`fetchNewestBuckets`)**

RED: `pnpm test src/photos/stores/__tests__/timeline.test.ts` (after appending the brief's 4
test cases, before implementing the action):
```
FAIL  ... > fetchNewestBuckets loads the newest N dated buckets
TypeError: s.fetchNewestBuckets is not a function
(4 failed | 46 passed)
```
Expected: `fetchNewestBuckets` did not exist yet on the store.

GREEN: same command after adding the action and exporting it:
```
Test Files  1 passed (1)
Tests  50 passed (50)
```

**View-level guards (PhotosAlbums + PhotosLibraryPicker)**

These were designed together with their implementation, so true RED evidence was captured by
stashing just the implementation file and re-running the new tests against the old code:

```
git stash push -- src/views/PhotosAlbums.vue
pnpm test src/views/__tests__/PhotosAlbums.test.ts -t "bucket mode"
```
```
FAIL  ... source==='recent' in bucket mode → the two newest buckets are fetched before the
       album exists, and addAssetsToAlbum only gets photos actually in hand
AssertionError: expected "vi.fn()" to be called with arguments: [ 2026, 7, 500, +0 ]
Number of calls: 0

FAIL  ... source==='recent' in bucket mode, no photos within 30 days → createAlbum is never
       called and the toast reports failure, not success
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
  1st vi.fn() call: [ "Empty30d" ]
(2 failed | 48 passed)
```
Expected: without `fetchNewestBuckets`/the empty-guard, `getTimelineBucket` is never called and
`createAlbum` fires unconditionally — exactly the two silent-failure modes the brief diagnosed.

`git stash pop` restored the fix; GREEN: `pnpm test src/views/__tests__/PhotosAlbums.test.ts` →
50 passed.

For `PhotosLibraryPicker.vue`, RED came from the *first* implementation attempt (following the
brief's Step 5 snippet close to verbatim — unconditional `void timeline.fetchNewestBuckets(3)`
right after `if (...) void timeline.fetchTimeline()`):
```
FAIL  ... 打开时(分桶模式)调用 fetchNewestBuckets 拉最新几个月,而不是只等目录到达
AssertionError: expected "vi.fn()" to be called with arguments: [ 2026, 8, 500, +0 ]
Number of calls: 0

FAIL  ... 滚到接近底部时拉下一个未加载的有日期桶;连续两次滚动不重复请求同一个桶
AssertionError: expected "vi.fn()" to be called 3 times, but got 0 times
(2 failed | 15 passed)
```
Root cause: `fetchNewestBuckets` was fired in parallel with (not after) `fetchTimeline`, so it
read `bucketMode.value` before the probe inside `fetchTimeline` had a chance to flip it — a
real ordering bug in the brief's snippet, not a test-setup mistake (confirmed by inspecting
`timeline.ts`'s `fetchTimeline`: `bucketMode.value = true` is only set after `await
service.photos.getTimelineBuckets()` resolves). Fixed by wrapping both calls in a single async
IIFE so `fetchNewestBuckets` only runs after `fetchTimeline` (when needed) has resolved. GREEN
after the fix: `pnpm test src/photos/components/__tests__/PhotosLibraryPicker.test.ts` → 17
passed.

## Which element the picker's scroll handler is attached to, and how determined

`.lib-picker-body` (the middle flex section between the head and the foot buttons). Determined
by reading the component's own `<style scoped>` block before writing any handler:
`.lib-picker-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px 18px; }` —
the only element in this template with `overflow-y: auto`. `.lib-picker-panel` and
`.lib-picker-overlay` (the two ancestors) do not scroll; they size to the viewport and let the
body scroll internally.

## Files changed

- `src/photos/stores/timeline.ts` — added `fetchNewestBuckets`.
- `src/photos/stores/__tests__/timeline.test.ts` — added `describe('photos-timeline
  fetchNewestBuckets', ...)` with the brief's 4 cases verbatim (translating none — brief had no
  Chinese comments in this snippet).
- `src/views/PhotosAlbums.vue` — restructured `confirmCreate()`'s recent-fill branch.
- `src/views/__tests__/PhotosAlbums.test.ts` — added `getTimelineBuckets`/`getTimelineBucket` to
  the mocked service, a `notFound()` helper + default-404 wiring in `beforeEach` (so every
  pre-existing test keeps exercising the legacy path unchanged), imported
  `__resetBucketProbeForTest` (the probe backoff is a module-level timestamp that survives
  across tests in one file and would otherwise skip the probe for whichever bucket-mode test
  runs after an earlier 404), and 2 new tests for the bucket-mode success/empty-guard paths.
- `src/photos/components/PhotosLibraryPicker.vue` — sequenced `fetchNewestBuckets(3)` after
  `fetchTimeline` on open, added `onListScroll` with a `loadingMore` guard, wired
  `@scroll="onListScroll"` on `.lib-picker-body`.
- `src/photos/components/__tests__/PhotosLibraryPicker.test.ts` — same mock/backoff scaffolding
  as PhotosAlbums.test.ts, plus 2 new tests (open → fetchNewestBuckets; scroll-to-bottom loads
  next bucket, two scrolls don't double-request).

Commit: `e0ebbb2` — "fix(photos): bucket mode broke months<->allPhotos invariant for two
consumers" (English, imperative subject, body explains why).

## Self-review

- Opening the picker in bucket mode populates it: verified by the new "打开时…调用
  fetchNewestBuckets" test (asserts `getTimelineBucket` called for all 3 newest dated months).
- Scrolling to the bottom loads the next unloaded dated bucket, and two quick scrolls do not
  double-request it: verified by the new scroll test (2 rapid `scroll` events → exactly 1 extra
  `getTimelineBucket` call, for the correct month).
- The album path no longer creates an empty album while reporting success: verified by the new
  "no photos within 30 days" test (`createAlbum` never called, failure toast shown, no toast
  containing the album title).
- Both consumers behave exactly as before in legacy mode: all 3 pre-existing `'recent'` tests in
  `PhotosAlbums.test.ts` (including the fake-timers boundary case and the cold-start case) and
  all 15 pre-existing `PhotosLibraryPicker.test.ts` cases still pass unmodified — their mocked
  service objects don't configure `getTimelineBuckets` to resolve, so `bucketMode` never
  activates and `fetchNewestBuckets` is always a no-op for them, exactly matching the "no-op
  outside bucket mode" contract.
- No new i18n key: reused `photosAlbumCreateFailed` (present in both `zh_cn.photos.ts` and
  `en_us.photos.ts`); ran `pnpm exec vue-tsc --noEmit` clean and did not touch any locale file.
- Test output pristine: all three target files pass 100% (117/117); the only failures anywhere
  in the repo are the OSS export guard's dirty-tree checks against this task's own uncommitted
  files, which resolve once committed (see "What was tested").

## Concerns

- None outstanding for the code itself. One thing worth flagging for whoever verifies on a real
  device: `fetchNewestBuckets(3)` and `fetchNewestBuckets(2)` both run on top of whatever
  `fetchBucket`'s existing paging/dedup/failure-handling already does, so their behaviour under
  a slow or flaky backend is exactly `fetchBucket`'s existing behaviour (leaves the bucket
  unloaded on failure, retried naturally on the next call) — this task added no new retry logic
  and none was asked for.
- The brief's Step 5 snippet (unconditional `void timeline.fetchNewestBuckets(3)` right after
  the `fetchTimeline()` guard) has the ordering bug described above under TDD evidence; the
  brief is not itself buggy in a way that matters once fixed, but anyone reading the brief
  literally in the future should use the sequenced version in the actual component, not the
  brief's inline snippet.
