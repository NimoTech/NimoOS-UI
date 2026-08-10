# Task 10 report: 索引轮询只刷目录 + 防抖

## What I implemented

`src/photos/stores/timeline.ts`:

- New module-level debounce state (a timestamp, not store state, matching the
  existing `_bucketProbeRetryAfter` pattern):
  ```ts
  const INDEX_REFRESH_DEBOUNCE_MS = 3_000
  let _lastIndexRefreshAt = 0

  export function __resetIndexRefreshForTest(): void {
    _lastIndexRefreshAt = 0
  }
  ```
- `fetchIndexStatus`'s "indexed grew" branch now forks on `bucketMode.value`:
  - bucket mode → `refreshBuckets()` (directory-only refetch), gated by the
    3s debounce window computed from `Date.now()`
  - legacy mode → unchanged `refreshTimelineQuiet()` call (full timeline refetch)
- `__resetForTest()` now also calls `__resetIndexRefreshForTest()`, alongside the
  existing `__resetBucketProbeForTest()` call, so one test's debounce timestamp
  can't silence the next test's assertion.

`src/photos/stores/__tests__/timeline.test.ts`: added a new describe block,
`photos-timeline fetchIndexStatus directory refresh (bucket mode)`, placed
between the existing `photos-timeline bucket mode` and `photos-timeline
fetchBucket` blocks (same isolation boilerplate as the other bucket-mode
describes: fresh Pinia + cleared mocks + fake timers + `__resetBucketProbeForTest()`
in `beforeEach`). Three tests, verbatim from the brief:

1. `refreshes only the directory while indexing progresses` — two growth
   observations back-to-back, expects exactly one `getTimelineBuckets` call and
   zero `getTimeline` calls.
2. `debounces the directory refresh to at most one per 3 seconds` — same setup,
   then `vi.advanceTimersByTime(3001)` past the window, expects a second
   `getTimelineBuckets` call after the window elapses.
3. `keeps the legacy quiet refresh when buckets are unavailable` — 404s the
   probe so the store stays in legacy mode, expects `getTimeline` (not
   `getTimelineBuckets`) to fire on growth.

## Testing

- RED: `pnpm test src/photos/stores/__tests__/timeline.test.ts`
  ```
  ❯ src/photos/stores/__tests__/timeline.test.ts (57 tests | 2 failed) 73ms
      × refreshes only the directory while indexing progresses 2ms
      × debounces the directory refresh to at most one per 3 seconds 1ms

  AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
   ❯ ...expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(1)

   Test Files  1 failed (1)
        Tests  2 failed | 55 passed (57)
  ```
  Expected and correct: before the fix, growth in bucket mode still called
  `refreshTimelineQuiet()` (which calls `getTimeline`, not `getTimelineBuckets`),
  so `getTimelineBuckets` was never invoked from `fetchIndexStatus`. The third
  test (legacy path) passed even pre-fix, since that branch was never touched.

- GREEN: `pnpm test src/photos/stores/__tests__/timeline.test.ts`
  ```
   Test Files  1 passed (1)
        Tests  57 passed (57)
  ```

- Wider: `pnpm test src/photos/stores`
  ```
   Test Files  11 passed (11)
        Tests  392 passed (392)
  ```
  (stderr shows one `Error: Not implemented: navigation (except hash changes)`
  line from `favorites.test.ts` — this is the known jsdom navigation noise
  called out in the task instructions as a non-defect, unrelated to this diff,
  and does not fail any test.)

- Types: `pnpm exec vue-tsc --noEmit` → no output, clean.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/stores/timeline.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/stores/__tests__/timeline.test.ts`

## Self-review

- Two consecutive growth observations → one `getTimelineBuckets` call: confirmed
  by test 1 and test 2's first assertion.
- After the 3s window elapses, a third observation → a second call: confirmed by
  test 2's final assertion (`vi.advanceTimersByTime(3001)` then a third
  `fetchIndexStatus`).
- The full timeline endpoint (`getTimeline`) is never called in bucket mode:
  confirmed by test 1's second assertion.
- Legacy mode still does the full quiet refetch unchanged: confirmed by test 3,
  and by the diff showing `refreshTimelineQuiet()` untouched in the `else`
  branch (same call the two pre-existing legacy-mode `fetchIndexStatus` tests
  in the top describe block already pin).
- The new reset hook (`__resetIndexRefreshForTest`) is wired into
  `__resetForTest()` — verified in the diff and by the fact that the new
  describe block's tests pass in isolation and in the full suite run (no
  cross-test debounce leakage, since `vi.useFakeTimers()` resets the fake clock
  per test but the module-level `_lastIndexRefreshAt` timestamp would otherwise
  persist across tests without this wiring).
- No Chinese on any line this diff touches — the two new comment blocks
  (`INDEX_REFRESH_DEBOUNCE_MS` rationale, describe-block rationale) and all
  three test descriptions are English, matching the brief verbatim.
- Test output is pristine except the known non-defect noise called out above.

## Concerns

None. The implementation is a direct, minimal port of the brief's Step 3 code
with no deviations, and all four verification points in the task's own
self-review checklist are satisfied.
