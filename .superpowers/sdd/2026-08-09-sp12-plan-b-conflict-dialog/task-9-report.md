# Task 9 report: wire the conflict dialog into Files.vue

## What was implemented

`src/views/Files.vue`:

- Imported `FileConflictDialog` and `useUploadConflicts`; instantiated `const conflicts = useUploadConflicts()` alongside the other stores.
- Rewrote `commitSelectedFiles` to merge the refill and normal branches into one flow:
  1. Consume `refillPending` (unchanged ordering/comment — still read-and-null before any early return).
  2. Snapshot-view write guard (unchanged, still first).
  3. Compute `wanted` (filtered against `pending.missing` when refilling) and `targetPath` (batch's own `target_path` when refilling, else `files.currentPath`) — unchanged logic, just no longer duplicated per branch.
  4. **New:** normalize leading slashes via `toSelectedFiles(wanted, targetPath)` and feed that into `conflicts.resolveEntries(normalized, targetPath)` — both branches now go through this, not just one.
  5. If `resolved.accepted` is empty, toast `filesUploadSkipped` (only when `dropped > 0`) and return — nothing is enqueued.
  6. Otherwise build `sel` from `resolved.accepted` (carrying each entry's own `conflictPolicy`), call `uploads.addFilesToQueue(sel)`, toast protected-dir rejections (unchanged), then toast `filesUploadSkipped` if anything was also skipped/cancelled alongside the accepted entries.
- Added `<FileConflictDialog>` to the template, at the same level as `<UploadPanel />`, forwarding all seven fields the brief specifies (`open`, `name`, `target-path`, `is-dir`, `allow-merge`, `queue-index`, `queue-total`) plus `@choose="conflicts.onChoose"` and `@cancel="conflicts.onCancel"`.

New test file `src/views/__tests__/Files.uploadConflict.test.ts` — 6 tests (the brief's 5 plus one defect-fix test):

1. `a colliding upload opens the conflict dialog and enqueues with the chosen policy`
2. `skipping every conflicting entry enqueues nothing and toasts the skipped count`
3. `cancelling the dialog cancels the batch`
4. `a refill also goes through conflict resolution`
5. `forwards the dialog choose event — deleting the @choose handler must fail this test` (the forced-RED proof test)
6. `detects a conflict even when relativePath carries a leading slash` (defect-fix test, not in the brief's list — added per the task's explicit instruction to prove the normalization-ordering fix)

Idiom follows the existing `src/views/Files.upload.test.ts` sibling exactly: same mock shape for `@nimotech/nimoos-service`, same `makeRouter`/pinia/`IntersectionObserver` stub setup. New addition: `waitForDialogOpen(w)` polls `w.findComponent(FileConflictDialog).props('open')` across `nextTick()` ticks (the resolveEntries chain crosses several microtask hops before Vue re-renders), and the dialog is driven via `w.findComponent(FileConflictDialog).vm.$emit('choose'/'cancel', ...)` — the same `findComponent(...).vm.$emit(...)` idiom already used in `src/components/WallpaperDialog.test.ts`.

## Normalization ordering — how the defect was fixed and where the rule lives

The brief's Step 3 pseudocode built `sel` after resolving conflicts, using entries whose `relativePath` had not yet been normalized. That reproduces the described defect: `groupByTopSegment` (in `uploadConflict.ts`) keys off the first `/`-delimited segment, and an entry like `/Docs/a.txt` groups under `''` (`indexOf('/')` is `0`, so `rel.slice(0, 0)` is empty) — which can never match anything in the target listing's `Map<string, boolean>`, so a real collision with an existing `Docs` folder is silently missed.

Fix: normalize **before** calling `resolveEntries`, not after. I reused `toSelectedFiles` (from `selectedFiles.ts`) for this — it already contains the leading-slash-stripping regex and its own unit test suite (`selectedFiles.test.ts`), and its signature (`entries, targetPath) => SelectedFile[]`) is structurally compatible with what `resolveEntries` expects (`UploadEntry[] = {file, relativePath}[]`) since TS does not apply excess-property checks to a variable being passed to a narrower parameter type (only to fresh object literals). So:

```ts
const normalized = toSelectedFiles(wanted, targetPath)
const resolved = await conflicts.resolveEntries(normalized, targetPath)
```

`toSelectedFiles` itself was **not modified** — its signature, behavior, and existing test file are untouched. This keeps the stripping rule living in exactly one place, as the task required, and avoids the second regex copy the brief's literal pseudocode would have produced if followed as written (which also wouldn't have fixed the ordering bug — the brief's own version normalizes only in the final `sel` map, after conflict detection already ran on the raw un-normalized `wanted`).

The new test `detects a conflict even when relativePath carries a leading slash` proves this: uploading a file with `webkitRelativePath: '/Docs/a.txt'` against a target listing containing an existing `Docs` folder still opens the dialog with `name: 'Docs'`, `isDir: true` — confirming the top segment is correctly resolved as `'Docs'`, not `''`.

## Tests run and results

### TDD evidence (RED → GREEN on the new test file)

**RED** — ran with `Files.vue` reverted to its pre-task-9 state (via `git stash push -- src/views/Files.vue`, confirmed by `git status`/`git stash list`):

```
$ pnpm exec vitest run src/views/__tests__/Files.uploadConflict.test.ts
 ❯ src/views/__tests__/Files.uploadConflict.test.ts (6 tests | 6 failed) 272ms
     × a colliding upload opens the conflict dialog and enqueues with the chosen policy
     × skipping every conflicting entry enqueues nothing and toasts the skipped count
     × cancelling the dialog cancels the batch
     × a refill also goes through conflict resolution
     × forwards the dialog choose event — deleting the @choose handler must fail this test
     × detects a conflict even when relativePath carries a leading slash

 Test Files  1 failed (1)
      Tests  6 failed (6)
```
Failure causes: `Cannot call props on an empty VueWrapper` (FileConflictDialog isn't mounted at all — `waitForDialogOpen` never finds it) for 5 tests, and a call-argument mismatch (`getList` called with `/DATA` instead of `/DATA/Elsewhere`, because there was no conflict-resolution pass to route through the batch's own target path) for the refill test. Exactly the expected failure mode — matches the brief's Step 2 expectation ("弹窗组件不存在 / addFilesToQueue 拿到的 policy 为空").

Then `git stash pop` restored the implementation (confirmed clean via `git status`).

**GREEN**:
```
$ pnpm exec vitest run src/views/__tests__/Files.uploadConflict.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

### Sibling-test fallout (unavoidable consequence of the wiring, fixed)

`src/views/Files.upload.test.ts`'s mocked `service.folder.getList` always returned a fixed listing containing `a.txt`, and asserted exact `addFilesToQueue` call arguments without a `conflictPolicy` field. Once every `commitSelectedFiles` call started going through `resolveEntries` (which lists the target directory), this file broke: the "enqueues a selected file..." test uploaded a file literally named `a.txt`, spuriously collided with the mock's own `a.txt`, and hung until timeout; three other tests failed on an exact-match diff missing the new `conflictPolicy: ''` field. Fixed by renaming the mock's fixture entry to `existing.txt` (documented with a comment explaining why) and adding `conflictPolicy: ''` to the four affected `toHaveBeenCalledWith` assertions. This is the direct, unavoidable footprint of task 9's own change (not unrelated refactoring) — `toSelectedFiles`'s own dedicated test file (`selectedFiles.test.ts`) was untouched since its signature didn't change.

### Full verification run (after restoring the implementation, before commit)

```
$ pnpm exec vitest run src/views/ src/files/
 Test Files  136 passed (136)
      Tests  1380 passed (1380)
```

```
$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

### Forced-RED forwarding self-proof (per the task's explicit requirement)

Deleted `@choose="conflicts.onChoose"` from the template (kept `@cancel`), re-ran the conflict test file:

```
$ pnpm exec vitest run src/views/__tests__/Files.uploadConflict.test.ts --testTimeout=6000
 ❯ src/views/__tests__/Files.uploadConflict.test.ts (6 tests | 3 failed) 18368ms
     × a colliding upload opens the conflict dialog and enqueues with the chosen policy   (Test timed out in 6000ms)
     × skipping every conflicting entry enqueues nothing and toasts the skipped count      (Test timed out in 6000ms)
     × forwards the dialog choose event — deleting the @choose handler must fail this test (Test timed out in 6000ms)

 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)
```
The 3 red tests are exactly the ones that emit `choose` and await the resulting promise (test 1, test 2, and the dedicated forwarding-proof test 5) — without the `@choose` listener, `conflicts.onChoose` is never called, the pending resolver never settles, and `await p` hangs until the test times out. The 3 tests that stayed green use `cancel` (still wired) or the non-colliding refill path (never opens the dialog), which is the expected, correct split.

Restored the line, re-ran:
```
$ pnpm exec vitest run src/views/__tests__/Files.uploadConflict.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
```
Both outputs above are the exact, unedited command outputs from this session.

## Files changed

- `src/views/Files.vue` — wiring (see diff above), commit `e85fa52`
- `src/views/__tests__/Files.uploadConflict.test.ts` — new, 6 tests
- `src/views/Files.upload.test.ts` — fixture rename (`a.txt` → `existing.txt`) + 4 assertions updated with `conflictPolicy: ''`, both required by the wiring change, not unrelated refactoring

## Self-review

- Both branches resolve conflicts: confirmed — `wanted`/`targetPath` are computed per-branch, then both flow through the single `toSelectedFiles` → `conflicts.resolveEntries` → `addFilesToQueue` pipeline. No separate early-return path skips resolution.
- Normalization genuinely before detection: confirmed — `toSelectedFiles(wanted, targetPath)` runs, then its *result* is passed into `resolveEntries`; the dedicated test (`detects a conflict even when relativePath carries a leading slash`) exercises this directly and passes.
- Snapshot guard survived: unchanged, still the first check after reading `pending`.
- Protected-dir toast survived: `uploads.addFilesToQueue(sel)` → `for (const name of rejected) toast.show(...)` is unchanged, just now runs after the conflict-resolution step instead of instead of it.
- All seven dialog props forwarded: `open`, `name`, `target-path`, `is-dir`, `allow-merge`, `queue-index`, `queue-total` — verified against the template diff; matches the brief's Step 3 markup exactly (plus `@choose`/`@cancel`).
- Output is pristine: `vue-tsc --noEmit` produced no output; `vitest run src/views/ src/files/` reported 136/136 files and 1380/1380 tests passing with no failures.

## Concerns

- None outstanding for this task. The one deviation from the brief's literal Step 3 code is the normalization-ordering fix the task explicitly required (reusing `toSelectedFiles` before `resolveEntries` instead of building `sel` with a fresh `.map()` after), and the one file outside the brief's stated Step 5 file list (`Files.upload.test.ts`) that had to be touched is a direct, minimal, and unavoidable consequence of routing every `commitSelectedFiles` call through conflict detection — not unrelated refactoring.

---

# Fix round 1 report

## 1. Unguarded bindings: `:allow-merge`, `:queue-index`, `:queue-total`

**Root cause of the gap**: `allowMerge`/`queueIndex`/`queueTotal` all have `withDefaults` fallbacks in `FileConflictDialog.vue:40` (`false`/`0`/`1`). Every existing test in the suite only ever produced a queue of exactly one conflict, so the real values always happened to equal the defaults — deleting any of those three bindings was invisible to both vue-tsc and the test suite.

**Fix**: added one new test, `opens the folder prompt with the real allowMerge and queue position, not the dialog defaults`, to `src/views/__tests__/Files.uploadConflict.test.ts`. It uploads two top-level groups against a target listing containing two existing folders:
- `Trip/photo.jpg` — a nested upload landing on an existing folder `Trip` → a genuine mergeable folder-into-folder collision.
- `Vacation` — a flat *file* upload landing on an existing folder `Vacation` → a type mismatch (upload is a file, target is a dir), not mergeable.

`splitConflictsByKind` classifies both into the **same** folder queue (`existingIsDir` is true for either), in insertion order, so the first dialog to open is for `Trip` with `allowMerge: true` and `queueTotal: 2`, `queueIndex: 0` — exactly the snapshot where a missing `:allow-merge` or `:queue-total` binding would previously go unnoticed. No existing test was modified or weakened.

Also added `waitForDialogClose(w)` (mirrors `waitForDialogOpen`) and inserted it after every `$emit('choose'/'cancel', ...)` call in the file, replacing the previous reliance on vitest's default 5000/6000ms test timeout for detecting a broken `@choose`/`@cancel` forward. It polls `props('open')` for `false` across up to 50 `nextTick()`s and throws a **named** error (`'conflict dialog never closed after choose/cancel — the @choose/@cancel forwarding is broken'`) if it never does — so a broken handler now fails fast and legibly instead of reading as CI flake.

### Forced-RED proof #1 — `:allow-merge`

Deleted `:allow-merge="conflicts.dialog.value.allowMerge"` from `Files.vue`'s template (line 652), ran:

```
$ pnpm exec vitest run src/views/__tests__/Files.uploadConflict.test.ts
 ❯ src/views/__tests__/Files.uploadConflict.test.ts (7 tests | 1 failed) 1139ms
     × opens the folder prompt with the real allowMerge and queue position, not the dialog defaults 121ms

 FAIL  src/views/__tests__/Files.uploadConflict.test.ts > Files.vue upload-conflict wiring > opens the folder prompt with the real allowMerge and queue position, not the dialog defaults
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/views/__tests__/Files.uploadConflict.test.ts:272:37
    270|     const dlg = w.findComponent(FileConflictDialog)
    271|     expect(dlg.props('name')).toBe('Trip')
    272|     expect(dlg.props('allowMerge')).toBe(true)
       |                                     ^

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```

Restored the line, ran again:

```
$ pnpm exec vitest run src/views/__tests__/Files.uploadConflict.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

### Forced-RED proof #2 — `:queue-total`

Deleted `:queue-total="conflicts.dialog.value.queueTotal"` from `Files.vue`'s template (line 654), ran:

```
$ pnpm exec vitest run src/views/__tests__/Files.uploadConflict.test.ts
 ❯ src/views/__tests__/Files.uploadConflict.test.ts (7 tests | 1 failed) 1162ms
     × opens the folder prompt with the real allowMerge and queue position, not the dialog defaults 125ms

 FAIL  src/views/__tests__/Files.uploadConflict.test.ts > Files.vue upload-conflict wiring > opens the folder prompt with the real allowMerge and queue position, not the dialog defaults
AssertionError: expected 1 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 1

 ❯ src/views/__tests__/Files.uploadConflict.test.ts:273:37
    271|     expect(dlg.props('name')).toBe('Trip')
    272|     expect(dlg.props('allowMerge')).toBe(true)
    273|     expect(dlg.props('queueTotal')).toBe(2)
       |                                     ^

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```

Restored the line, ran again:

```
$ pnpm exec vitest run src/views/__tests__/Files.uploadConflict.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

Both proofs are fast, specific assertion failures (not timeouts) — the prop simply falls back to its `withDefaults` default when the binding is missing, and the new test's expected value differs from that default by construction.

### `queueIndex` caveat (reported honestly, not swept under)

The new test also asserts `queueIndex === 0` on the same dialog snapshot, but this specific assertion is **not** independently forced-RED-provable the same way: `queueIndex`'s default (`0`) happens to equal the real value for the *first* conflict in a queue, so deleting `:queue-index` would not flip this particular assertion (it would still read `0` from the default). The coordinator's fix request asked only for proofs against `:allow-merge` and `:queue-total`, so no additional round-2 dialog was added to exercise a nonzero `queueIndex`. Flagging this so it isn't mistaken for a proven guard — `:queue-index` remains guarded only incidentally (a *second* conflict's dialog, e.g. index 1, would need a dedicated assertion to prove it for real; not added here since it wasn't requested and would require driving the queue to its second prompt).

## 2. Chinese comment translated

`src/views/Files.vue` line 233 (the ternary this task introduced):

```diff
- const targetPath = pending ? pending.targetPath : files.currentPath // REAL 路径,受保护目录判断按此展开
+ const targetPath = pending ? pending.targetPath : files.currentPath // REAL path — the protected-dir check expands against this.
```

No other Chinese comments in the file were touched (per instruction — only this line, which this task rewrote from a plain assignment to a ternary).

## Full verification after both fixes

```
$ pnpm exec vitest run src/views/ src/files/
 Test Files  136 passed (136)
      Tests  1381 passed (1381)
```
(1381 vs. the earlier 1380 — the one net-new test.)

```
$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

## Files changed (this round)

- `src/views/Files.vue` — one-line comment translation only (the wiring itself was untouched and judged correct by the reviewer)
- `src/views/__tests__/Files.uploadConflict.test.ts` — added `waitForDialogClose`, wired it into all 5 existing choose/cancel emissions, added the new allowMerge/queueTotal/queueIndex test

Commit: `10636f8` — test(files): guard the three conflict-dialog bindings the suite missed
