# Task 5 report: store 单桶翻页 + 目录刷新失效（fetchBucket / refreshBuckets）

## What was implemented

`src/photos/stores/timeline.ts`:

- Imports added: `assetToPhoto` (from `../util/assetToPhoto`), `parseBucketKey` and
  `staleBucketKeys` (from `../util/timelineBuckets`).
- Module-level constants `BUCKET_PAGE_SIZE = 500`, `BUCKET_MAX_PAGES = 40`, and a
  module-level in-flight map `_bucketInflight: Map<string, Promise<void>>`, declared next to the
  existing `_bucketProbeRetryAfter` singleton.
- `__resetBucketProbeForTest()` now also clears `_bucketInflight` (previously only reset the
  probe backoff timestamp).
- New action `fetchBucket(key: string): Promise<void>`:
  - No-op outside bucket mode, if the key is already cached, if a request for that key is
    already in flight, if the key doesn't parse (`parseBucketKey`), or if the key has no
    matching directory entry.
  - Otherwise pages `service.photos.getTimelineBucket(year, month, 500, offset)` in a loop
    (offset = `page * 500`), converting each row with `assetToPhoto`, stopping when a page comes
    back short (`< 500` rows) or the running total reaches the directory's `count`, and warns
    (does not throw or loop again) if it runs out of the 40-page budget without reaching either
    stopping condition.
  - On success, writes the full page-concatenated `Photo[]` into `bucketAssets` under `key`.
  - On failure, logs and leaves `bucketAssets` untouched (the month stays unloaded).
  - `finally` always clears the loading flag and removes the entry from `_bucketInflight`.
- New action `refreshBuckets(): Promise<void>`:
  - No-op outside bucket mode.
  - Refetches the directory, computes `staleBucketKeys(oldBuckets, newBuckets, loadedKeys)`,
    deletes those keys from `bucketAssets` plus any key that no longer exists in the new
    directory, then swaps in the new `buckets` and the new `bucketAssets` map. Buckets whose
    count didn't change are never touched, so their `Photo[]` reference survives untouched.
  - On failure, logs and leaves both `buckets` and `bucketAssets` untouched (old directory kept).
- `fetchBucket` and `refreshBuckets` added to the store's returned object.

`src/photos/stores/__tests__/timeline.test.ts`: appended the brief's two new `describe` blocks
verbatim for the `it()` bodies, with one addition — see "Deviation from the brief" below.

## Deviation from the brief (and why)

The brief's two new `describe` blocks (`photos-timeline fetchBucket`, `photos-timeline
refreshBuckets`) as pasted only call `__resetBucketProbeForTest()` in `beforeEach`, with no
`setActivePinia(createPinia())`, no `vi.clearAllMocks()`, and no `afterEach` teardown. This repo
has no `clearMocks`/global reset config (checked `vite.config.ts`'s `test` block and
`vitest.setup.ts` — neither resets mocks), and Pinia setup-stores don't get an automatic
`$reset()`. Vitest runs `describe` blocks and their `it()`s in file order without isolation
between sibling describes unless the hooks provide it.

I ran the brief's tests exactly as written first (see RED/GREEN evidence below) and hit real
failures from this: mock call counts and `bucketAssets`/`buckets` state leaked from one test into
the next within the same describe (e.g. "does not refetch a month it already holds" inherited an
already-loaded `'2026-08'` bucket from an earlier test and made zero calls instead of one; "is a
no-op outside bucket mode" saw `getTimelineBuckets` already called dozens of times from prior
tests). This is exactly the class of bug this file's own pre-existing "photos-timeline bucket
mode" describe already guards against with its own `beforeEach`/`afterEach` pair — so I added the
identical pattern (`setActivePinia(createPinia())`, `vi.clearAllMocks()`, `vi.useFakeTimers()` in
`beforeEach`; `useTimelineStore().__resetForTest()` + `vi.useRealTimers()` in `afterEach`) to both
new describes. Every `it()` body, assertion, and mock value in the brief is otherwise unchanged.

## TDD evidence

**RED** — `pnpm test src/photos/stores/__tests__/timeline.test.ts` (brief's tests appended,
store not yet implemented):

```
 Test Files  1 failed (1)
      Tests  14 failed | 32 passed (46)
```

All 14 failures were `TypeError: s.fetchBucket is not a function` / `s.refreshBuckets is not a
function` — the correct failure reason (interface didn't exist yet), and the 32 pre-existing
tests were untouched.

**Intermediate check** — after implementing the store but before adding the missing
`beforeEach`/`afterEach` isolation to the two new describes, the same command gave:

```
 Test Files  1 failed (1)
      Tests  8 failed | 38 passed (46)
```

Failures were all cross-test pollution (wrong call counts / stale cached bucket data), confirming
the brief's test scaffolding needed the isolation hooks described above, not a store logic bug.

**GREEN** — after adding the isolation hooks, `pnpm test src/photos/stores/__tests__/timeline.test.ts`:

```
 Test Files  1 passed (1)
      Tests  46 passed (46)
```

Re-ran with `npx vitest run ... --reporter=verbose` to check for hidden `[Vue warn]` noise (per
this repo's known "vitest default reporter hides warnings" trap): all 46 tests print `✓`, and the
only `stderr` output is the expected `console.error`/`console.warn` lines from the deliberate
failure-path tests (`bucket probe` 404, `keeps probing after a non-404 failure`, `fetchBucket
2026-08 Error: boom`, `refreshBuckets Error: boom`) — same pattern as the pre-existing tests in
this file, no unexpected warnings.

**Wider suite** — `pnpm test src/photos/stores`:

```
 Test Files  11 passed (11)
      Tests  378 passed (378)
```

(One `Error: Not implemented: navigation` line printed from `favorites.test.ts` — this is the
documented known non-defect, unrelated to this task.)

**Type check** — `pnpm exec vue-tsc --noEmit`: no output, exit clean.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/stores/timeline.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/stores/__tests__/timeline.test.ts`

## Self-review (per the task's checklist)

- Paging stops on reaching the directory count (`pages until the directory count is covered`)
  and on a short page (`stops paging early when a page comes back short`) — both pass.
- Page ceiling: `console.warn` fires only on the last iteration (`page === BUCKET_MAX_PAGES - 1`)
  and only reached if neither break condition fired first, then the `for` loop's own bound ends
  it — no infinite loop, no throw. Not separately unit-tested by the brief; verified by code
  reading of the loop structure (warn is placed after both `break` checks, so a page that
  satisfies either break never reaches the warn, and the loop guard `page < BUCKET_MAX_PAGES`
  terminates regardless).
- Same key requested twice concurrently produces one request — `dedupes concurrent requests for
  the same month` passes (`_bucketInflight` returns the shared promise to the second caller).
- Already-loaded key produces no request — `does not refetch a month it already holds` passes.
- A failure leaves the month unloaded and a later retry works — `leaves a month unloaded on
  failure so scrolling back retries it` passes (nothing is written to `bucketAssets` in the
  `catch` branch).
- Unknown/junk key fires no request — `ignores an unknown key instead of firing a request with
  NaN` passes (`parseBucketKey` returns `null`, function returns before touching the service).
- Unchanged buckets keep referential identity across a refresh — `keeps an unchanged month
  byte-identical so the grid does not flash` passes with `toBe`, not `toEqual` (the `map` in
  `refreshBuckets` is a shallow copy of the previous `bucketAssets`; only stale/vanished keys are
  deleted from it, so an untouched key's `Photo[]` reference is carried over unchanged).
- A failed refresh keeps the old directory — `keeps the old directory when the refresh fails`
  passes (the `catch` branch only logs; `buckets.value` and `bucketAssets.value` are never
  reassigned on that path).
- Both actions confirmed no-op outside bucket mode by dedicated tests.
- Test output is pristine (verbose run checked above).

## Concerns

- The test-isolation gap documented above (missing `beforeEach`/`afterEach` in the brief's pasted
  describes) is worth flagging to whoever owns the brief template for tasks 8/9/10, in case they
  copy the same scaffolding pattern for their own new describes in this file.
- No other concerns. Interfaces (`fetchBucket`, `refreshBuckets`, `BUCKET_PAGE_SIZE`,
  `BUCKET_MAX_PAGES`, `_bucketInflight`) match the brief's names/values exactly for Tasks 8/9/10
  to depend on.
