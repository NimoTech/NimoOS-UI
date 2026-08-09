# Task 4 report: 批次生命周期接线

Commit: `af7ba85` — `feat(files): report upload batches and signal interruption`

## What was implemented

1. **`src/files/stores/uploads.ts`** — `addFilesToQueue` now reports the batch
   manifest to `service.uploadBatches.createBatch` *before* `queue.value.push(...items)`,
   and awaits it. The call is skipped when `items.length === 0` (all files rejected
   as protected). A rejected `createBatch` call is caught and only `console.warn`s —
   it never blocks queuing. Comment above the block explains why manifest-before-chunk
   matters and why a failure only warns (in English, per workspace CLAUDE.md).

2. **`src/files/upload/unloadGuard.ts`**
   - New exported `activeBatchIds(queue: UploadItem[]): string[]` — dedups batch ids
     of items whose status is `'uploading'` or `'pending'`; ignores falsy `batchId`;
     returns `[]` for non-array input (mirrors `hasActiveUploads`'s defensive style).
   - `installUnloadGuard` gained an optional third parameter `interruptBatch?: (id: string) => void`.
     A new `pagehide` listener is registered unconditionally, but it only calls
     `interruptBatch` (once per id from `activeBatchIds`) when that callback was
     supplied — no-op otherwise. The cleanup function returned by `installUnloadGuard`
     now removes both the `beforeunload` and `pagehide` listeners.

3. **`src/views/Files.vue`** — the sole call site now passes the third argument:
   `installUnloadGuard(() => uploads.queue, undefined, (id) => service.uploadBatches.interruptBatch(id))`.
   `service` was already imported in this file (line 49, pre-existing, used by
   `getList` at line 276) — no new import needed. (I briefly added a duplicate
   `import { service } from '@nimotech/nimoos-service'` per the brief's literal step,
   then removed it on noticing the existing import — see "self-review" below.)

## `installUnloadGuard` call sites

Searched the whole `src/` tree (`grep -rn "installUnloadGuard" src/`). Exactly one
call site outside the guard's own test file: `src/views/Files.vue:440`. It is the
one updated above. No other call site exists, so there was nothing else to check for
"two-argument callers must keep compiling" — the only caller now uses three arguments.
The two-argument overload is still valid per the signature (`interruptBatch?`), and
is exercised by the pre-existing `installUnloadGuard(() => queue, win)` call in
`unloadGuard.test.ts`'s original `describe('installUnloadGuard', …)` block, which
still passes unmodified.

## TDD evidence

### RED — store side
```
pnpm exec vitest run src/files/stores/uploads.batch.test.ts
```
First run (before any implementation): 2 of 3 failed —
`expected "createBatch" to be called 1 times, but got 0 times` (test 1) and a
second failure on test 2 (see "one deviation" below). Expected/confirmed: `createBatch`
did not exist to be called yet.

### GREEN — store side (after implementing the `createBatch` call)
```
pnpm exec vitest run src/files/stores/uploads.batch.test.ts
```
```
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

### RED — unloadGuard side
```
pnpm exec vitest run src/files/upload/unloadGuard.test.ts
```
```
FAIL … collects batch ids of unfinished items only, deduped
TypeError: activeBatchIds is not a function
FAIL … sends one interrupt per active batch on pagehide
TypeError: listeners.pagehide is not a function
 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```
Matches the brief's expected failure mode exactly.

### GREEN — unloadGuard side
```
pnpm exec vitest run src/files/upload/unloadGuard.test.ts
```
```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## One deviation from the brief's test file (with justification)

The brief's `uploads.batch.test.ts` (Step 1) does not mock `../upload/scheduler`.
`addFilesToQueue` calls `startUpload()` synchronously once the queue has a pending
item, and `startUpload()` → `getScheduler().run()` synchronously claims the item
(`claimNext()` sets `status = 'uploading'`) before the first `await` inside the
real scheduler/tus pipeline is reached — this is inherent JS async-function
semantics (a `for` loop calling `async` workers runs synchronously up to the first
internal `await`), not something introduced by this task's change. The sibling
file `uploads.test.ts` already works around exactly this by stubbing
`createScheduler` (see its `vi.mock('../upload/scheduler', …)` with a
no-op/`autoComplete` run). Without an equivalent stub, the brief's second test —
"still queues the upload when the manifest call fails", asserting
`s.queue[0].status === 'pending'` — observed `'uploading'` instead, because the
real (unmocked) scheduler had already synchronously claimed the only item by the
time the assertion ran. I confirmed this by running the test unmodified first (RED
for the expected `createBatch` reason on test 1, but test 2 failed for this
different, scheduler-driven reason) before touching production code.

Fix applied: added the same style of scheduler stub already established in
`uploads.test.ts` to `uploads.batch.test.ts`:
```ts
vi.mock('../upload/scheduler', () => ({
  createScheduler: () => ({ run: vi.fn().mockResolvedValue(undefined), isRunning: () => false, abort: vi.fn(), pause: vi.fn() }),
}))
```
This does not change any assertion's meaning — it isolates the manifest-reporting
test from the unrelated transfer subsystem (which a unit test for `createBatch`
reporting shouldn't be exercising against a real, unmocked tus/network client
anyway). All three of the brief's original assertions in each `it` block are
unchanged verbatim.

## Full-suite results

- **Before (controller-verified baseline at `5579dc6`):** 641 files / 10382 tests, all passing.
- **After (post-commit `af7ba85`):**
  ```
  pnpm test
   Test Files  642 passed (642)
        Tests  10387 passed (10387)
  ```
  Delta: +1 file (`uploads.batch.test.ts`, new), +5 tests (3 in the new store
  test file + 2 new `it` blocks appended to `unloadGuard.test.ts`). No other file's
  test count changed. `pnpm exec vue-tsc --noEmit` is clean.

### Transient false failures during development (not a regression)

While my Task 4 edits were still uncommitted, `pnpm test` showed 4 failing test
files (`oss/cli-args.test.mjs` ×2 tests, `oss/export-rsync.test.mjs` ×1) with the
error `工作树不干净,导出中止` (working tree not clean, export aborted) — this is
`oss/export.mjs`'s own pre-flight guard reacting to my modified/untracked files
under `src/`. I verified this was not caused by the pre-existing unrelated dirty
files (`design-export/*.html` deletions, `oss/*` modifications, `oss/cli-args.test.mjs`
untracked) by `git stash push -u` on just my Task 4 files and re-running
`oss/cli-args.test.mjs` alone — it passed (5/5) with only the pre-existing dirty
files present, confirming the oss guard already tolerates that dirty state (it's
designed to, via `--allow-dirty-oss` semantics for the `oss/` directory itself).
I then `git stash pop` to restore my Task 4 work, committed with the specified
pathspec, and re-ran the full suite — all 642/642 files passed, no failures.

### Unrelated fix required to get `vue-tsc` clean: broken pnpm hardlink

`pnpm exec vue-tsc --noEmit` initially failed with
`Property 'uploadBatches' does not exist on type '{ … }'` for both
`src/files/stores/uploads.ts` and `src/views/Files.vue`, even though
`packages/service/src/index.ts` already exposes `uploadBatches` (added in Task 1,
commit `7352c8e`). Per the New-UI CLAUDE.md's documented "hardlink trap": comparing
inodes showed `packages/service/src/uploadBatches.ts` had no corresponding file at
all under `node_modules/.pnpm/@nimotech+nimoos-service@file+packages+service/.../src/uploadBatches.ts`
— the hardlink set was stale from before Task 1's file was added. Ran `pnpm install`
(no `--force`, no cache clearing) to relink; inodes matched afterward and `vue-tsc`
came back clean. This is environmental drift from a prior task, not something
introduced by Task 4's own edits.

## Files changed (committed in `af7ba85`)

- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/stores/uploads.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/stores/uploads.batch.test.ts` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/upload/unloadGuard.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/upload/unloadGuard.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/views/Files.vue`

Not committed (pre-existing, unrelated, untouched by me, verified not staged before
committing): `design-export/*.html` deletions, `oss/README.md`, `oss/export.mjs`,
`oss/manifest.mjs`, `oss/cli-args.test.mjs` (untracked).

## Self-review

- Scope matches the brief exactly: `activeBatchIds` export, `installUnloadGuard`'s
  new optional third param, the `createBatch` call ordered before `queue.value.push`,
  the `Files.vue` call-site update. No adjacent refactor.
- All code comments are in English (workspace CLAUDE.md hard requirement); the three
  Chinese comments named in "Controller rulings" #1 were rendered in English with the
  same reasoning preserved (manifest-before-chunk rationale; warn-not-block rationale;
  pagehide-fires-on-both-paths rationale; the two Chinese comments inside the test
  files as well).
- Tests assert on real behavior, not mock plumbing: the store test reads the actual
  first positional argument handed to `createBatch` (`arg.targetPath`, `arg.items`,
  `arg.id === s.queue[0].batchId`) rather than just call-count; the unloadGuard test
  reads the actual ids passed to `interruptBatch` (`c[0]`) in call order, not just
  call count.
- Caught my own mistake mid-task: momentarily added a second, duplicate
  `import { service } from '@nimotech/nimoos-service'` to `Files.vue` per the
  brief's literal Step 8 text, before noticing the file already imports `service`
  at line 49 (used elsewhere in the file). Removed the duplicate; final diff for
  `Files.vue` is a single-line change.
- Corrected my own commit message: my first `git commit` invocation appended a
  `Co-Authored-By` trailer out of habit (from generic commit-workflow instructions).
  The brief's Step 10 message has no such trailer, and prior Task 1–3 commits in
  this same sequence (`7352c8e`, `f698518`, `5579dc6`) also carry no trailer.
  Amended the commit (only my own just-created commit, nothing upstream) to match
  the brief and the sequence's established style verbatim.
- Test output is pristine for the two files I touched (no console noise). The
  full-suite jsdom "Not implemented: navigation" warnings are pre-existing, from
  unrelated `src/photos/stores/__tests__/favorites.test.ts`, exactly the documented
  known non-finding.
- Did not touch `DesktopContextMenu.test.ts` or anything related to it.

## Concerns

None blocking. Two things worth flagging to whoever picks up Task 5/6:
1. The scheduler-mock gap in the brief's `uploads.batch.test.ts` (see "One deviation"
   above) — worth keeping in mind if future SP12 tests import `useUploadsStore` and
   drive `addFilesToQueue` without stubbing `../upload/scheduler`; the real scheduler
   will synchronously claim pending items with a real (unmocked) tus/network call.
2. The pnpm hardlink drift under `node_modules/.pnpm/...` for the service package —
   already documented as a known trap in this repo's CLAUDE.md, but this is a fresh
   instance of it (from Task 1's addition of `uploadBatches.ts`, not from this task's
   own edits). Anyone hitting a "property does not exist" TS error against
   `@nimotech/nimoos-service` types that looks wrong given the source should check
   inodes / run `pnpm install` before assuming a real type error.

---

# Fix report: ordering invariant was unenforced by any test

Commit: `8dc62c4` — `test(files): pin the manifest-before-enqueue ordering in the batch test`

## Reviewer finding

`src/files/stores/uploads.batch.test.ts` asserted the final `createBatch` call
arguments and the final queue state, but never asserted that `createBatch` runs
*before* `queue.value.push(...items)`. Since the whole `addFilesToQueue()` call
is awaited before any assertion runs, the test would pass identically if the two
statements in `src/files/stores/uploads.ts` were swapped — silently defeating the
exact race the brief calls out as the reason for the ordering rule. Scope of this
fix: add one assertion that pins call order. Explicitly out of scope per the
coordinator (deferred to the ledger): the two dropped comment details, the
`activeBatchIds` / `hasActiveUploads` `&& item.file` asymmetry, and a missing
cleanup test for `pagehide` listener removal — none of these were touched.

## What was changed

Added one new test to the existing `describe('addFilesToQueue reports the batch
manifest', …)` block in `src/files/stores/uploads.batch.test.ts` (no existing
test was modified):

```ts
it('reports the manifest before the items are queued', async () => {
  // Pins the ordering invariant itself, not just the final state: capture the
  // queue's length synchronously inside the mock, at the exact moment
  // createBatch is invoked — before any of its internal awaits run. If the
  // manifest call were moved after `queue.value.push(...items)`, this would
  // observe length 1 instead of 0.
  const s = useUploadsStore()
  let queueLengthAtCallTime = -1
  createBatch.mockImplementationOnce(() => {
    queueLengthAtCallTime = s.queue.length
    return Promise.resolve(undefined)
  })
  await s.addFilesToQueue([pick('a.txt', 3)])
  expect(queueLengthAtCallTime).toBe(0)
})
```

This observes queue state from inside the `createBatch` mock itself — at the
instant the mock function body runs (synchronously, before its own `await`
inside the real implementation would matter — the mock never awaits before
capturing), `s.queue` must not yet contain the item being reported. That is a
direct pin on call order, not on end state: it fails if and only if the push
happens first.

No production code changed net of this fix — `src/files/stores/uploads.ts` is
byte-identical to the previously committed `af7ba85` version (confirmed via
`git diff`, empty output, after the deliberate-reorder-and-revert below).

## Deliberate-RED proof (before restoring correct order)

I temporarily reordered `src/files/stores/uploads.ts` to push the queue before
reporting the manifest, to prove the new test actually catches that reordering:

```ts
// TEMP: deliberately reordered to prove the ordering test catches it — DO NOT COMMIT
queue.value.push(...items)
if (items.length > 0) {
  try {
    await service.uploadBatches.createBatch({ … })
  } catch (e) { … }
}
```

Command:
```
pnpm exec vitest run src/files/stores/uploads.batch.test.ts
```

Output (RED):
```
 ❯ src/files/stores/uploads.batch.test.ts (4 tests | 1 failed) 27ms
     × reports the manifest before the items are queued 5ms

 FAIL  src/files/stores/uploads.batch.test.ts > addFilesToQueue reports the batch manifest > reports the manifest before the items are queued
AssertionError: expected 1 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 1

 ❯ src/files/stores/uploads.batch.test.ts:63:35
     61|     })
     62|     await s.addFilesToQueue([pick('a.txt', 3)])
     63|     expect(queueLengthAtCallTime).toBe(0)
       |                                   ^
     64|   })

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

This is exactly the expected failure: with the push moved first, `createBatch`
observes the item already in the queue (`queueLengthAtCallTime === 1`), so the
new assertion (`toBe(0)`) fails. The other 3 pre-existing tests in the file
still pass unaffected, confirming the new test is what's catching the
regression, not a side effect of the temporary edit breaking something else.

## GREEN proof (after reverting to the correct order)

Reverted `src/files/stores/uploads.ts` to the original order (manifest report
before `queue.value.push(...items)`) and confirmed via `git diff
src/files/stores/uploads.ts` that the file is byte-identical to the version
committed in `af7ba85` (empty diff output).

Command:
```
pnpm exec vitest run src/files/stores/uploads.batch.test.ts
```

Output (GREEN):
```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## Covering test file run again post-commit, plus type check

```
pnpm exec vitest run src/files/stores/uploads.batch.test.ts
```
```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

```
pnpm exec vue-tsc --noEmit
```
Output: (empty — clean, no errors)

Covering test file: `src/files/stores/uploads.batch.test.ts` (the only file this
fix touches; it exercises `addFilesToQueue`'s ordering, which is the surface
under review).

## Commit

```
git add src/files/stores/uploads.batch.test.ts
git commit -m "test(files): pin the manifest-before-enqueue ordering in the batch test …"
```
`git status --short` before staging confirmed only `src/files/stores/uploads.batch.test.ts`
was touched by this fix; the pre-existing unrelated dirty files
(`design-export/*.html` deletions, `oss/README.md`, `oss/export.mjs`,
`oss/manifest.mjs`, untracked `oss/cli-args.test.mjs`) were left untouched and
unstaged, per the path-scoped `git add` requirement. Resulting commit: `8dc62c4`.

## Self-review

- The new test fails if and only if the ordering is wrong (proven above with an
  actual reorder-and-run, not just reasoning about the code).
- Did not touch anything the coordinator marked out of scope for this round.
- Did not modify the three pre-existing tests in the file — only added one.
- No production code net change (`uploads.ts` diff against `af7ba85` is empty).
