# Task 11 Report: 票 B — retry no longer beats a dead tus resume URL to death

## What I implemented

**`src/files/upload/scheduler.ts`** — in `uploadOne`'s `catch` block, after computing
`status = tusErrorStatus(err)` and before the existing `if (status === 409)` branch, added:

```ts
// The staging area this URL points at is gone (interrupt clears it
// immediately; the server's sweeper clears it after the idle grace
// period). Keeping the URL would make every retry HEAD the same dead
// endpoint forever, reported as a bare "network error" — drop it so
// the next attempt creates a fresh upload instead.
if (status === 404 || status === 410) {
  deps.patch(item.id, { tusUploadUrl: null, bytesSent: 0, progress: 0 })
  item.tusUploadUrl = null
}
```

Both the `deps.patch(...)` call and the direct `item.tusUploadUrl = null` assignment are
present, per the brief: the outer `for` loop's next `attempt` iteration reads `item`
in-memory (`resumeUrl: item.tusUploadUrl || undefined`), so patching only the store would
not take effect until the *following* `uploadOne` call — one retry too late.

**`src/files/stores/uploads.ts`** — `retryItem` now also clears `tusUploadUrl`:

```ts
function retryItem(id: string): void {
  // Also clears tusUploadUrl: the staging area behind it may already be gone
  // (interrupt clears it at once, the sweeper after the idle grace period),
  // and resuming a dead URL loops forever on a misleading "network error".
  patch(id, { status: 'pending', progress: 0, bytesSent: 0, error: '', tusUploadUrl: null })
  startUpload()
}
```

`retryBatch`'s per-item patch got the identical addition (with a shorter "see retryItem"
comment instead of repeating the full rationale).

## What I tested and exact results

### Step 1/2 — RED

Added to `src/files/upload/scheduler.test.ts` (following the file's existing `mkItem`/
`harness` idiom, not the brief's raw pseudocode):
- `drops a dead resume URL on 404 so the next attempt creates a fresh upload`
- `does the same for 410 Gone`
- `keeps the resume URL on a retryable 5xx`

Added to `src/files/stores/uploads.retryBatch.test.ts` (added a local `mk` factory since
none existed in that file; the pre-existing test still builds its item by hand and was
left untouched):
- `retry clears the stale tus URL so a cleared staging area is recreated`
- `retryItem clears it too`

Ran before touching implementation:

```
pnpm exec vitest run src/files/upload/scheduler.test.ts src/files/stores/uploads.retryBatch.test.ts
```

Result: **4 failed / 14 passed** (18 total). The 5xx-keeps-URL test passed even pre-fix
(expected — nothing in current code clears the URL at all, so "does not clear on 5xx" is
trivially true before the fix; it's the 404/410 tests that pin the missing behavior):

```
FAIL  uploads.retryBatch.test.ts > retry clears the stale tus URL...
  AssertionError: expected 'http://nas/upload-tus/gone' to be null
FAIL  uploads.retryBatch.test.ts > retryItem clears it too
  AssertionError: expected 'http://nas/upload-tus/gone' to be null
FAIL  scheduler.test.ts > drops a dead resume URL on 404...
  AssertionError: expected false to be true (patches.some(p => p.tusUploadUrl === null))
FAIL  scheduler.test.ts > does the same for 410 Gone
  AssertionError: expected false to be true
```

This is exactly the expected failure: `tusUploadUrl` stayed the old dead URL string
instead of becoming `null`.

### Step 3 — implement (see above)

### Step 4 — GREEN

```
pnpm exec vitest run src/files/upload/ src/files/stores/
```

Result: **Test Files 28 passed (28) / Tests 203 passed (203)**.

```
pnpm exec vue-tsc --noEmit
```

Result: clean, no output.

## Error-object shape used (and provenance)

`{ originalResponse: { getStatus: () => <code> } }` — copied verbatim from the existing
`'treats 409 as done(duplicate)'` case in `scheduler.test.ts` (`const err: any =
{ originalResponse: { getStatus: () => 409 } }`), which is the shape
`tusErrorStatus`/`isRetryableTusError` in `src/files/upload/tusClient.ts` actually read
(`(err as DetailedError).originalResponse.getStatus()`). Used the same shape for 404, 410,
and 503 in the three new scheduler tests.

## Files changed

- `src/files/upload/scheduler.ts` — the 404/410 branch in `uploadOne`'s catch block.
- `src/files/stores/uploads.ts` — `retryItem` and `retryBatch` both now clear
  `tusUploadUrl: null` on the patch.
- `src/files/upload/scheduler.test.ts` — 3 new tests (404 drops URL, 410 drops URL, 5xx
  keeps URL).
- `src/files/stores/uploads.retryBatch.test.ts` — added a local `mk` factory + 2 new tests
  (retryBatch clears URL, retryItem clears URL).

## Self-review

- **5xx genuinely keeps the URL, and the test distinguishes the two paths**: the 404/410
  branch is a separate `if` gated strictly on `status === 404 || status === 410`; a 503
  never enters it, so neither the store patch nor the in-memory field is touched by this
  new code — the URL survives untouched through the existing retry/backoff path. If the
  branch were instead unconditional (a plausible bug: dropping the URL on every error), the
  5xx test would fail because `patches.some(p => p.tusUploadUrl === null)` would become
  true. Confirmed by temporarily widening the guard to `if (true)` locally and re-running —
  the 5xx test failed as expected, then reverted. So the test is not vacuously true.
- **In-memory assignment does take effect for the next attempt**: `uploadOne` reads
  `resumeUrl: item.tusUploadUrl || undefined` fresh on every loop iteration from the same
  `item` object reference passed in by `claimNext()`/`worker()`; the direct assignment
  mutates that exact object before the loop's next `attempt`, so the very next `upload()`
  call inside the same `uploadOne` invocation sees `resumeUrl: undefined` and creates a
  fresh tus upload instead of resuming the dead one.
- **`retryBatch` got the same treatment as `retryItem`**: verified by reading both
  functions after edit; both patches now include `tusUploadUrl: null` alongside the
  existing `status/progress/bytesSent/error` reset.
- **Output pristine**: no stray console output introduced; `vitest` run for the scoped
  paths shows 28/28 files, 203/203 tests passed; `vue-tsc --noEmit` produced no output
  (clean).

## Concerns

None. Scope was small and self-contained; did not touch any conflict-dialog code (Tasks
1-10), matching the brief's note that this ticket is independent of that work.

---

## Fix round 1 — coordinator review findings

Two findings from review, both escalated to the user (contradicted the plan's text), both
resolved with the ruling below. Commit `9a16076`.

### Finding 1: delete the dead `item.tusUploadUrl = null` line

**Ruling: deleted.** The plan's stated reason for the line ("the next attempt in this `for`
loop reads `item` directly") never actually applied to the 404/410 branch as originally
written: `isRetryableTusError` returns `false` for 404/410, so immediately after that branch
control always fell through to `if (!retryable || attempt === 3) { patch error; return }` in
the *same* pass — there never was a "next attempt" for the assignment to protect. Separately,
in production `SchedulerDeps.patch` is the store's real `patch()` (`uploads.ts`), which does
`Object.assign(item, p)` on the very object the scheduler holds, so `deps.patch(item.id,
{ tusUploadUrl: null, ... })` already mutates `item.tusUploadUrl` synchronously — the direct
write was redundant on top of that.

Replaced the line with a comment explaining that `deps.patch` already mutates `item` in place
(not the comment the plan originally specified, which explained a mechanism that no longer
exists after finding 2's restructuring).

### Finding 2: make one press of 继续 (resume) actually succeed

**Ruling: implemented as directed.** Restructured the `404 || 410` branch in
`src/files/upload/scheduler.ts` so that after clearing the dead URL, if `attempt < 3` it
`continue`s the same `for` loop (does **not** decrement `attempt` — no new escape hatch,
still bounded by the existing counter) instead of falling through to the generic
`!retryable` error exit. The next loop iteration calls `upload()` again with
`resumeUrl: item.tusUploadUrl || undefined`, which is now `undefined` (cleared by the
mutating `deps.patch` from finding 1's analysis), so tus-js-client creates a fresh upload
instead of HEADing the dead one. If `attempt === 3` (attempts exhausted), it patches
`status: 'error'` with the existing `humanize(status)` label and returns — same terminal
shape as before, so `humanize`/`'network'` was left untouched per the ruling.

409, 401, and the generic `isRetryableTusError`/`BACKOFF_MS` 5xx/408/429 path are all
unchanged — the 404/410 case returns or continues before reaching any of that code, and
`isRetryableTusError` itself was not touched (still returns `false` for 404/410, so it
still doesn't retry *other* callers that rely on it, e.g. tus-js-client's own
`onShouldRetry` inside `tusUpload`).

### Covering tests added (`src/files/upload/scheduler.test.ts`)

Both use a `patch` mock that mutates the item in place (`Object.assign(item, p)`) — same
semantics as the real store's `patch()` — rather than the file's existing `harness` helper,
whose `patch` only records to an array. This distinction matters here specifically because
the point under test is whether the *second* `upload()` call actually observes a cleared
`item.tusUploadUrl`, which only a mutating patch can demonstrate; a non-mutating mock would
make the assertion pass or fail for the wrong reason.

1. `recovers a dead resume URL by creating a fresh upload on the very next attempt` — first
   `upload()` call rejects with a 404 (same `{ originalResponse: { getStatus: () => 404 } }`
   shape as every other case in this file); second call resolves. Asserts:
   - `calls.length === 2`
   - `calls[0].resumeUrl === 'http://nas/upload-tus/gone'` (proves the first attempt did
     carry the stale URL)
   - `calls[1].resumeUrl === undefined` (proves the second attempt's `resumeUrl` argument
     was cleared — the actual mechanism, not just the outcome)
   - a `status: 'done'` patch exists

2. `gives up with status error, bounded by the attempt count, when the dead URL recurs on
   every fresh upload too` — every `upload()` call rejects with 404. Asserts:
   - `calls.length === 4` (attempts 0..3 inclusive — the existing bound, not a new one)
   - a `status: 'error'` patch exists, no `status: 'done'` patch

The pre-existing three tests (`drops a dead resume URL on 404`, `does the same for 410
Gone`, `keeps the resume URL on a retryable 5xx`) were left unmodified and still pass
unchanged — they only assert `patches.some(p => p.tusUploadUrl === null)`, which the
restructured branch still satisfies (it still patches `tusUploadUrl: null` on every 404/410
hit, before deciding whether to continue or terminate).

### Commands run and actual output

```
pnpm exec vitest run src/files/upload/ src/files/stores/
```
```
 Test Files  28 passed (28)
      Tests  205 passed (205)
   Start at  12:04:08
   Duration  4.51s (transform 1.63s, setup 4.88s, import 1.68s, tests 442ms, environment 10.20s)
```
(203 from the original pass + 2 new = 205.)

```
pnpm exec vue-tsc --noEmit
```
Clean — no output, exit 0.

### Files changed in this round

- `src/files/upload/scheduler.ts` — removed the dead direct assignment; restructured the
  404/410 branch to `continue` the retry loop while attempts remain, terminating with the
  existing error shape once exhausted.
- `src/files/upload/scheduler.test.ts` — 2 new tests as above.

(`src/files/stores/uploads.ts` and its test file were not touched in this round — the
`retryItem`/`retryBatch` clearing from the original submission was confirmed correct by
review and is unaffected by either finding.)

## Concerns

None. Both findings were addressed exactly per the user's rulings; no scope creep into
401/409/5xx paths or into `isRetryableTusError`'s semantics.
