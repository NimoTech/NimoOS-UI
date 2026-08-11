# Task 4 report: timeline store 分桶状态 · 探测 / 回退 / 退避 / 月份 / 计数

## What was implemented

`src/photos/stores/timeline.ts`:

- Module-level backoff: `BUCKET_PROBE_BACKOFF_MS = 10 * 60_000`, `_bucketProbeRetryAfter` (plain
  variable, not store state), `__resetBucketProbeForTest()` exported at module level.
- New store state: `buckets: Ref<BucketMeta[]>`, `bucketAssets: Ref<Map<string, Photo[]>>`,
  `bucketLoading: Ref<Set<string>>`, `bucketMode: Ref<boolean>`.
- `months` computed branches on `bucketMode`: bucket branch maps `buckets` through
  `bucketToMonth(b, bucketAssets.get(bucketKey(b)) ?? null)`; legacy branch is the original
  `timelineGroups.value.map(g => groupToMonth(g))`, untouched.
- New `totalCount` getter; `photoCount`/`videoCount` now branch on `bucketMode` (bucket branch
  sums `BucketMeta.count`/`videoCount` directly from the directory; legacy branch is the original
  `allPhotos`-scan implementation, untouched).
- `fetchTimeline()` rewritten: if `Date.now() >= _bucketProbeRetryAfter`, tries
  `service.photos.getTimelineBuckets()` first. On success: `normalizeBuckets`, `bucketMode = true`,
  clears `timelineGroups` (so legacy and bucket data never both feed `months`), returns early. On
  failure: only a 404 (`isNotFound(e)`) arms the backoff; any other error just logs and falls
  through. Either way (probe skipped by backoff, or fallen through), it calls the original
  `service.photos.getTimeline()` legacy path unchanged.
- `resetState()` now also clears the four new fields; `__resetForTest()` now also calls
  `__resetBucketProbeForTest()`.
- Return object exposes `buckets, bucketAssets, bucketLoading, bucketMode, totalCount` in addition
  to the existing exports.
- Added a local type `TimelineMonth = Month & { loaded?: boolean; count?: number; videoCount?:
  number }` and typed `months` as `computed<TimelineMonth[]>` — needed because `bucketToMonth`'s
  return type is `Month & {loaded, count, videoCount}` (Task 6 owns widening `Month` itself, so
  this store-local type is deliberately not the same thing — `Month` in
  `src/photos/util/assetToPhoto.ts` was **not** touched).

`src/photos/stores/__tests__/timeline.test.ts`:

- Added `getTimelineBuckets: vi.fn()` and `getTimelineBucket: vi.fn()` to the hoisted `svc.photos`
  mock (both, per the brief, since Task 5 needs the second one).
- Appended the exact 7-test `describe('photos-timeline bucket mode', ...)` block from the brief,
  verbatim in content (see deviation note below for the `beforeEach`/`afterEach` wrapper).
- One necessary infrastructure fix in the **existing** `describe('photos-timeline store', ...)`
  `beforeEach` (see Deviations).

## Deviations from the brief's literal pseudocode (found via actual test execution, not guessed)

1. **Existing-suite `beforeEach` needed one added line.** Step 1 has me add
   `getTimelineBuckets: vi.fn()` to the *shared* `svc.photos` mock object used by both describe
   blocks. Running the suite with only that addition broke 4 of the 25 pre-existing tests: an
   unconfigured `vi.fn()` resolves to `undefined` (not a rejection), and
   `fetchTimeline`'s new probe treats *any* non-throwing result as a successful bucket response —
   `normalizeBuckets(undefined)` is `[]`, so it happily set `bucketMode = true` and returned before
   ever calling the legacy `getTimeline()` these old tests assert on. Fix: added one line to the
   existing `describe('photos-timeline store', ...)` `beforeEach`, right after `vi.clearAllMocks()`:
   `svc.photos.getTimelineBuckets.mockRejectedValue(notFound())`. This does not touch any test body
   or assertion — it only makes the shared mock's default behavior represent what these tests were
   always implicitly modeling: a legacy backend that has no bucket endpoints. I moved the
   `notFound()` helper (originally defined between the two describes) above both describes so both
   can use it.
2. **`describe('photos-timeline bucket mode', ...)` needed the same isolation as the sibling
   describe, not just `__resetBucketProbeForTest()`.** The brief's `beforeEach` was
   `beforeEach(() => { __resetBucketProbeForTest() })` only. Running it as-is: (a) `vi.useRealTimers()`
   was left active from the previous describe's `afterEach`, so `vi.advanceTimersByTime` in the
   10-minute-backoff test would not have worked; (b) Pinia's `setActivePinia` is a module-level
   global that isn't reset between sibling describes, so all 7 new tests would have shared **one**
   store instance and **unresetted** mock call counts — e.g. the "falls back to legacy on 404"
   test's `expect(s.bucketMode).toBe(false)` failed for real (observed `true`) because
   `bucketMode` from the two prior tests leaked through, and the 10-minute backoff test's
   `toHaveBeenCalledTimes(1)` failed against an accumulated count of 5. Fix: gave this describe the
   identical `beforeEach`/`afterEach` pair as the sibling block (`setActivePinia(createPinia())`,
   `vi.clearAllMocks()`, `vi.useFakeTimers()`, plus `__resetBucketProbeForTest()`; and
   `useTimelineStore().__resetForTest()` + `vi.useRealTimers()` in `afterEach`). No test body or
   assertion was changed — this is purely test-isolation infrastructure, and it is the *new*
   describe block Task 4 is adding, not one of the "existing tests" the brief says must not be
   rewritten.
3. **Broken pnpm hardlink for `packages/service/src/photos.ts`.** `vue-tsc --noEmit` reported
   `Property 'getTimelineBuckets' does not exist on type '{...}'` even though Task 1's
   `getTimelineBuckets`/`getTimelineBucket` are plainly in that file. `stat -c '%i'` showed the
   repo file and its `node_modules/.pnpm/.../src/photos.ts` hardlink counterpart had **different
   inodes** — exactly the "硬链接陷阱" documented in this repo's `CLAUDE.md` (an atomic-write edit
   during Task 1 broke the hardlink pnpm relies on). Fix: `pnpm install` (no `--force`, no cache
   clear) re-linked it; `git status`/`git diff --stat -- pnpm-lock.yaml` confirm this touched no
   tracked file.

None of these three changes touch view code, i18n files, or the `Month` interface, and none
change the legacy path's runtime behavior — they are test-infrastructure and environment fixes
surfaced by actually running the suite, as TDD requires.

## TDD evidence

### RED — `pnpm test src/photos/stores/__tests__/timeline.test.ts` (after Step 1, before Step 3)

```
 ❯ src/photos/stores/__tests__/timeline.test.ts (32 tests | 7 failed) 38ms
     × fetchTimeline probes the directory and enters bucket mode 1ms
     × exposes every directory month as an unloaded group, newest first 0ms
     × counts from the directory, so the totals are exact before anything loads 0ms
     × falls back to the legacy timeline on 404 and stays out of bucket mode 0ms
     × does not re-probe the directory for 10 minutes after a 404 0ms
     × keeps probing after a non-404 failure — a blip must not pin the user on the legacy path 0ms
     × drops legacy groups when it switches into bucket mode 0ms

TypeError: __resetBucketProbeForTest is not a function
 ❯ src/photos/stores/__tests__/timeline.test.ts:311:22
    311|   beforeEach(() => { __resetBucketProbeForTest() })

 Test Files  1 failed (1)
      Tests  7 failed | 25 passed (32)
```

Failed for the expected reason: the module doesn't export `__resetBucketProbeForTest` yet (and
`bucketMode`/`buckets`/`totalCount` don't exist on the store yet). The 25 pre-existing tests were
untouched and green at this point.

### GREEN — `pnpm test src/photos/stores/__tests__/timeline.test.ts` (after Step 3 + the two fixes above)

```
 Test Files  1 passed (1)
      Tests  32 passed (32)
```

Re-ran with `--reporter=verbose` to check for hidden `[Vue warn]` noise per this repo's known
pitfall — clean, all 32 named:

```
 ✓ ... photos-timeline store > fetchTimeline: 裸数组落 state,loading 包裹 7ms
 ✓ ... photos-timeline store > fetchTimeline: null/undefined 兜底为 [] 1ms
 ✓ ... photos-timeline store > refreshTimelineQuiet: 不改 loading 1ms
 ✓ ... photos-timeline store > months getter:按 groupToMonth 正确分组(标题/key/照片数) 2ms
 ✓ ... photos-timeline store > photoCount/videoCount:扫全部月份资产 1ms
 ✓ ... photos-timeline store > fetchIndexStatus: indexed 增长触发 refreshTimelineQuiet(...) 1ms
 ✓ ... photos-timeline store > fetchIndexStatus: indexed 不变/下降不触发 quiet 刷新 1ms
 ✓ ... photos-timeline store > fetchIndexStatus: idle(...)且无在途 upload 任务 → 清空 index 任务 1ms
 ✓ ... photos-timeline store > fetchIndexStatus: idle 但有在途 upload 任务 → 不清 index 任务(...) 1ms
 ✓ ... photos-timeline store > fetchIndexStatus: not idle(pending>0) → 不清 index 任务 1ms
 ✓ ... photos-timeline store > startIndexPoll: 立即拉一次 + 每 5s 轮询;幂等(重复调用不重开 timer) 4ms
 ✓ ... photos-timeline store > stopIndexPoll: 清干净,之后推进时间不再调用 1ms
 ✓ ... photos-timeline store > fetchTasks: 从 {tasks:[...]} 抽取 1ms
 ✓ ... photos-timeline store > fetchTasks: null/无 tasks 字段兜底为 [] 0ms
 ✓ ... photos-timeline store > ingestTaskBus: unwrap 后同 id 合并更新字段,新 id 追加 1ms
 ✓ ... photos-timeline store > ingestTaskBus: unwrap 失败(非法 payload)静默丢弃 0ms
 ✓ ... photos-timeline store > deleteAssets: 逐个调用 deleteAsset,计数成功数,之后 quiet 刷新 4ms
 ✓ ... photos-timeline store > deleteAssets: 全部失败仍不抛,返回 0,不触发刷新 1ms
 ✓ ... photos-timeline store > isIndexing getter:pending>0 或 queueLen>0 为真 1ms
 ✓ ... photos-timeline store > __resetForTest: 清 timer 且 $reset 状态 1ms
 ✓ ... photos-timeline store > ingestTaskBus: 非 index 类型 done 任务 5s 后从列表移除(...) 1ms
 ✓ ... photos-timeline store > ingestTaskBus: error 任务 10s 后从列表移除(...) 1ms
 ✓ ... photos-timeline store > ingestTaskBus: index 类型的 done 任务不走 5s 过期(...) 0ms
 ✓ ... photos-timeline store > ingestTaskBus: done 任务的移除计时器在同 id 再次 running 时取消 1ms
 ✓ ... photos-timeline store > __resetForTest 清掉挂起的 done 移除计时器(...) 1ms
 ✓ ... photos-timeline bucket mode > fetchTimeline probes the directory and enters bucket mode 1ms
 ✓ ... photos-timeline bucket mode > exposes every directory month as an unloaded group, newest first 1ms
 ✓ ... photos-timeline bucket mode > counts from the directory, so the totals are exact before anything loads 1ms
 ✓ ... photos-timeline bucket mode > falls back to the legacy timeline on 404 and stays out of bucket mode 1ms
 ✓ ... photos-timeline bucket mode > does not re-probe the directory for 10 minutes after a 404 0ms
 ✓ ... photos-timeline bucket mode > keeps probing after a non-404 failure — a blip must not pin the user on the legacy path 1ms
 ✓ ... photos-timeline bucket mode > drops legacy groups when it switches into bucket mode 1ms

 Test Files  1 passed (1)
      Tests  32 passed (32)
```

The only stderr lines during the verbose run are `console.error` calls from three tests that
*intentionally* exercise a failure path (`deleteAsset` boom ×2, "keeps probing after a non-404
failure" network-down log) — expected, not noise.

### Wider check — `pnpm test src/photos/stores`

```
 Test Files  11 passed (11)
      Tests  364 passed (364)
```

The one printed stack trace ("Not implemented: navigation ... favorites.test.ts") is jsdom's known
non-defect noise from an unrelated test file, called out in this task's own instructions as
something not to chase.

### Type check — `pnpm exec vue-tsc --noEmit`

Clean (no output) after fixing the broken hardlink (see Deviations #3) and typing `months` as
`TimelineMonth[]` (see Deviations narrative above; also see implementation section).

## Files changed

- `src/photos/stores/timeline.ts` (state, getters, `fetchTimeline`, `resetState`,
  `__resetForTest`, `__resetBucketProbeForTest`, `TimelineMonth`)
- `src/photos/stores/__tests__/timeline.test.ts` (new mocks, new describe block, one line added to
  existing `beforeEach`, `notFound()` helper moved above both describes)
- `pnpm install` re-linked a broken hardlink under `node_modules/.pnpm/@nimotech+nimoos-service@.../src/photos.ts`
  — no tracked file changed (`pnpm-lock.yaml` diff is empty).

## Self-review (per the task's checklist)

- **Legacy branch untouched in behavior**: confirmed — the legacy `months`/`photoCount`/
  `videoCount` computations and the legacy `getTimeline()` call in `fetchTimeline` are the
  original code, unchanged in logic; the 25 pre-existing tests pass unmodified in assertions.
- **Backoff arms only on 404**: confirmed — `_bucketProbeRetryAfter` is only written inside the
  `if (isNotFound(e))` branch; the "network down" test (generic `Error`, no `response.status`)
  proves `isNotFound` returns `false` for it and the backoff is never armed (test asserts a second
  probe attempt happens immediately).
- **`Date.now()` is the clock**: confirmed — both the read (`Date.now() >= _bucketProbeRetryAfter`)
  and the write (`_bucketProbeRetryAfter = Date.now() + BUCKET_PROBE_BACKOFF_MS`) use `Date.now()`;
  no `performance.now()` anywhere in the diff.
- **`timelineGroups` cleared on entering bucket mode**: confirmed, `timelineGroups.value = []`
  right before the early `return` in the probe-success branch; the "drops legacy groups" test
  exercises this explicitly.
- **Four state fields in `resetState()`**: confirmed — `buckets`, `bucketAssets`, `bucketLoading`,
  `bucketMode` are all reset there.
- **Nothing widened the `Month` interface**: confirmed — `git diff` touches only
  `src/photos/stores/timeline.ts` and its test file; `src/photos/util/assetToPhoto.ts` is
  untouched. The `TimelineMonth` type added is store-local, not an edit to `Month`.
- **Test output pristine**: confirmed via `--reporter=verbose`; no `[Vue warn]` or unexpected
  console output, only the three intentionally-logged failure-path lines.
- **Scope**: `git status --porcelain` shows only the two intended files changed; no view, no
  `PhotosGrid.vue`, no i18n file touched.

## Concerns

- None blocking. The three deviations above are documented fixes discovered by actually running
  the suite (not guesses), and none of them change runtime behavior of the legacy path or widen
  shared types — they are test-isolation/mocking corrections and one environment repair
  (`pnpm install` for the broken hardlink) that Tasks 5+ will also need in place to build on top of
  this store.
- Task 5 (`fetchBucket`/`refreshBuckets`) and Task 6 (widening `Month`) are explicitly out of scope
  here and were not touched.
