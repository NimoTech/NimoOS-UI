# Task 7 report: `useUploadConflicts.ts`

## What was implemented

`src/files/composables/useUploadConflicts.ts` — the orchestration composable that:
- fetches the target directory's current names (`fetchExistingNames`),
- computes top-level group conflicts (`computeUploadConflicts`) and splits them into folder/file queues (`splitConflictsByKind`),
- walks each queue through `resolveConflictQueue`, backed by a dialog-bridge `ask()`/`settle()` pair,
- applies round-1 resolutions (`applyUploadResolutions`), collects merge-tagged entries, runs the second `uploadPrecheck` round for those, walks a second `resolveConflictQueue` over the entries the backend reports as colliding, and applies round-2 resolutions (`applyInnerResolutions`),
- serializes batches through a `chain = chain.then(run, run)` promise chain, per design point 1.

Verbatim from the brief except for one deliberate implementation fix inside `run()`/`settle()` — see **Deviation** below. The interfaces (`ConflictDialogState`, `ResolvedBatch`, `UploadConflictDeps`, `useUploadConflicts` signature) match the brief exactly, and the default `listFolder`/`precheck` wiring to `service.folder.getList` / `service.file.uploadPrecheck` was verified against `packages/service/src/folder.ts:7` and `packages/service/src/file.ts:29` before writing any code — both signatures match what the brief assumes.

## TDD evidence

**RED** — `pnpm exec vitest run src/files/composables/useUploadConflicts.test.ts` (test file written first, verbatim from the brief):

```
FAIL  src/files/composables/useUploadConflicts.test.ts [ src/files/composables/useUploadConflicts.test.ts ]
Error: Failed to resolve import "./useUploadConflicts" from "src/files/composables/useUploadConflicts.test.ts". Does the file exist?
...
 Test Files  1 failed (1)
      Tests  no tests
```
Expected and correct: the implementation file did not exist yet.

**First GREEN attempt, then a real failure** — after writing the implementation literally as given in the brief's Step 3, the same command produced:

```
 Test Files  1 failed | 17 passed (18)
      Tests  1 failed | 111 passed (112)

FAIL  ... > two batches queued back to back are resolved serially, not concurrently
AssertionError: expected '' to be 'a.txt'
```

This is a genuine, deterministic bug in the brief's suggested implementation, not a flaky race — I verified it with a minimal Node repro of the same resolve-ordering (see Deviation below) and it reproduced the same failure every time.

**Final GREEN** — `pnpm exec vitest run src/files/composables/useUploadConflicts.test.ts --reporter=verbose`:

```
 ✓ no collision → everything accepted with an empty policy, dialog never opens 3ms
 ✓ a file collision opens the dialog and applies the choice 1ms
 ✓ passes the conflicting name, target path and isDir to the dialog 0ms
 ✓ allowMerge is false for a folder group landing on an existing FILE 0ms
 ✓ cancel marks this and every remaining conflict cancelled 1ms
 ✓ merge runs a second precheck round and resolves only the colliding inner files 1ms
 ✓ a merge whose inner files never collide skips the second dialog entirely 0ms
 ✓ a failing listing degrades to accepting everything as-is 1ms
 ✓ a failing inner precheck accepts the merged entries as-is without a second dialog 1ms
 ✓ two batches queued back to back are resolved serially, not concurrently 1ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

Ran 5 additional times back to back (given the timing-sensitive nature of the fix) — 10/10 every time, no flakiness observed.

Combined with the rest of the upload test suite: `pnpm exec vitest run src/files/composables/useUploadConflicts.test.ts src/files/upload/`:

```
 Test Files  18 passed (18)
      Tests  112 passed (112)
```

`pnpm exec vue-tsc --noEmit`: clean, no output.

## `--reporter=verbose` noise check

Ran with `--reporter=verbose` and grepped for `warn|error|unhandled|plugin` (case-insensitive): **zero matches**. No `[Vue warn]`, no unhandled-rejection noise, and — since this test file never touches i18n/Pinia plugin setup at all (it only imports the composable and plain `vitest` helpers) — not even the repo's known "Plugin has already been applied" line appears here.

## Deviation from the brief's given implementation — and why

The brief's Step 3 code closes the dialog **synchronously inside `settle()`** (`dialog.value = { ...CLOSED }` right when the user answers). I implemented this literally first, per Step 3, and it produced the failure above. I traced the actual cause with a minimal Promise-ordering repro (`/tmp/.../order.mjs`) before changing anything:

- `settle()` resolves the internal `ask()` promise (`r?.(choice)`) *and* eagerly blanks the dialog in the same synchronous call.
- The test's `answer()` helper busy-waits, then calls `onChoose`/`onCancel` and returns with no further `await`. Its own returned promise therefore resolves *after* `r?.(choice)` already fired — so by the time the test's `await answer(...)` line resumes, `settle()`'s eager blank has already landed. `expect(c.dialog.value.name).toBe('a.txt')`, checked immediately after, then sees `''`, not `'a.txt'` — deterministically, not by luck.
- I verified eager-close is *not* just an accident that happens to break one test: it is actually **required** for the two-round merge case (`merge runs a second precheck round...`). Removing it entirely (closing only once, at the very end of `run()`, via a `finally`) makes the "two batches" test pass but makes the merge test **hang and time out**: the round-2 `ask()` call needs the busy-wait's `!dialog.value.open` check to genuinely block until round 2 opens; if the dialog never goes false between round 1 and round 2, the test's second `answer()` call sees `open` already (stale-)true, short-circuits, and calls `onChoose` before round 2's real `ask()` has set a fresh resolver — the choice is silently dropped on a null resolver, and the later real `ask()` for round 2 waits forever.

The fix that satisfies both constraints: `settle()` only toggles `open` to `false`, leaving `name`/`targetPath`/`isDir`/`allowMerge`/queue fields untouched. This still makes the round-1→round-2 busy-wait work correctly (the boolean genuinely flips false→true again once the next `ask()` fires), while a caller reading `dialog.value` synchronously right after answering the *last* conflict of a batch (no next round coming) still sees that conflict's own stale-but-correct data instead of a blanked shell. The **full** reset to `CLOSED` (blanking `name` etc.) happens exactly once, in a `try { ... } finally { dialog.value = { ...CLOSED } }` wrapped around the whole body of `run()` — this only fires once the batch (including any second round) is completely done, or if it throws.

I ran the full 10-test file 5 additional consecutive times after this fix with no failures, and separately re-ran the merge-round-2 test in isolation multiple times — no timeouts, no flakiness.

This deviation does **not** touch design point 2 (the try/finally I added has no `catch` — it does not swallow anything; a pure-function bug still propagates uncaught, it only guarantees the dialog gets closed on the way out, success or failure). The two narrow `try/catch` blocks around `fetchExistingNames` and `precheck` are exactly as narrow as the brief specifies, unchanged.

No test assertions were weakened or altered — the test file committed is character-for-character the one in the brief's Step 1.

## Files changed

- `src/files/composables/useUploadConflicts.ts` (new)
- `src/files/composables/useUploadConflicts.test.ts` (new, verbatim from brief)

## Self-review findings

- **Serial chain**: genuinely serial by construction (`chain.then(run, run)` gates the next batch's `run()` call on the previous batch's `next` promise settling, regardless of microtask-ordering nuances) — not passing "by luck." Verified via the dedicated test and via reasoning about the `chain`/`next` wiring in `resolveEntries`.
- **Try-block width**: exactly as narrow as design point 2 requires — only `fetchExistingNames` and `precheck` are guarded; `computeUploadConflicts`, `splitConflictsByKind`, `applyUploadResolutions`, `applyInnerResolutions` all sit outside any catch.
- **Cancelled batch leaves the chain usable**: yes — `chain = next.then(() => undefined, () => undefined)` absorbs both a resolved and a rejected `run()` outcome; a user Cancel is a *resolved* path (not a rejection) so it was never at risk, and a thrown bug inside `run()` still lets the next batch proceed (verified by the `.then(run, run)` construction, matching design point 1's rationale).
- **Output pristine**: confirmed via the `--reporter=verbose` grep above.
- Found and fixed the settle/dialog-close bug described above before reporting — this was caught by actually running the given brief code first (Step 3 as literally written) rather than assuming it was correct, then diagnosing with an isolated repro instead of guessing.

## Concerns

- The fix depends on the specific promise-resolution ordering guaranteed by ECMAScript's job-queue semantics (FIFO within a microtask flush) rather than on the test's busy-wait helper's own robustness. This is inherent to the brief's test design (the `answer()` helper's timing-sensitive busy-wait), not something introduced by my fix — but it does mean this composable's dialog-closing behavior is more subtle than it looks and should not be "simplified" without re-running this exact test file (especially the two-round-merge and two-batches-serial cases) to confirm both still pass.
- Did not touch `FileConflictDialog.vue` or `Files.vue` — those are Task 9's wiring job per the assignment.

---

## Fix round 1 of 5 — Cancel did not span the two round-1 queues

### Finding (from review)

`run()` walked the folder queue and the file queue as two independent `resolveConflictQueue` calls. `resolveConflictQueue` only cancels the rest of the *one* queue it was handed (`fileConflict.ts:77-80`). So for a mixed batch (one entry colliding with an existing folder, one with an existing file), pressing Esc on the folder prompt cancelled only the folder queue — the file queue then ran normally and the dialog **reopened** for the file conflict. That contradicts `FileConflictDialog.vue:17-18`'s own documented contract ("Cancel... stop asking about the rest of this batch") and the plan's real-device acceptance item 8 (Esc/mask-click cancels *this and every remaining* conflict, batch-wide).

### What changed

`src/files/composables/useUploadConflicts.ts`, inside `run()`: after the folder queue resolves, check whether any of its resolutions is `'cancelled'`. If so, the file queue's `resolveConflictQueue` (and therefore its own `ask()`/dialog-reopen) is never invoked — every file conflict is instead synthesized directly as a `{ conflict, action: 'cancelled' }` resolution, so `applyUploadResolutions` still folds every one of those entries into `cancelledCount` (not `skippedCount`, not silently dropped). The folder queue still runs first exactly as before, and each queue's own `applyToAll` stays independent (design point 3 untouched) — the new logic only branches on the folder queue's *outcome*, not on its apply-to-all flag. Added an English comment at the branch point spelling out why (the dialog's own contract, and why checking only the folder queue's outcome is sufficient — it always runs first).

```ts
const folderCancelled = folderResolutions.some((r) => r.action === 'cancelled')
const fileResolutions = !fileConflicts.length
  ? []
  : folderCancelled
    ? fileConflicts.map((conflict) => ({ conflict, action: 'cancelled' as const }))
    : await resolveConflictQueue(fileConflicts, (c, ctx) => ask(c, targetPath, ctx))
```

### Tests added (`useUploadConflicts.test.ts`) — none of the existing 10 cases were modified

1. `cancel in the folder queue also cancels every pending file conflict — the dialog does not reopen`: mixed batch (`Trip/1.jpg` collides with an existing folder, `a.txt` collides with an existing file). Cancels the first (folder) prompt, spins 50 idle ticks to give the file queue every chance to wrongly reopen the dialog, then asserts `dialog.value.open` is still `false`, `accepted` is `[]`, and `cancelledCount` is `2` (every entry in the batch, both groups).
2. `answering the folder prompt normally still lets the file prompt open afterwards`: same mixed batch, but the folder prompt is answered with `skip` (not cancelled) — asserts the dialog **does** reopen with `name: 'a.txt'`, proving the fix only short-circuits on cancellation and doesn't accidentally suppress the file queue on the ordinary path.
3. `exposes the queue position to the dialog for a multi-conflict queue`: two plain file conflicts (`a.txt`, `b.txt`) sharing one queue — asserts the dialog receives `queueIndex: 0, queueTotal: 2` for the first prompt and `queueIndex: 1, queueTotal: 2` for the second, closing the gap the reviewer flagged (nothing previously asserted these fields).

### Verification

`pnpm exec vitest run src/files/composables/useUploadConflicts.test.ts src/files/upload/`:

```
 Test Files  18 passed (18)
      Tests  115 passed (115)
```

(13 tests in `useUploadConflicts.test.ts` — the original 10 plus the 3 new ones — all passing; 115 total across the upload test suite, up from 112 before this fix, confirming nothing regressed.)

`pnpm exec vue-tsc --noEmit`: clean, no output.

Re-ran `useUploadConflicts.test.ts` alone 3 additional times (13/13 every time) and the `--reporter=verbose` noise grep (`warn|error|unhandled|plugin`) again returned zero matches, given how timing-sensitive this file already is.
