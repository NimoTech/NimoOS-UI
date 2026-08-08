# Task 7 Report: 重传缺失文件 (re-upload only the files a batch is missing)

Commit: `57a4d5e` — `feat(files): re-upload only the files a batch is missing`

## What was implemented

1. **`UploadBatchModal.vue`**
   - Added a third emit: `(e: 'refill', payload: { targetPath: string; missing: string[] }): void`.
   - Added `refill()`: emits `refill` with the batch's `target_path` and the current
     `missing` list's relative paths, then emits `close`.
   - Added a footer button **before** the abandon button:
     `<button class="ubm-btn ubm-refill" :disabled="!missing.length" @click="refill">`.
     Per the controller's ruling, this uses `ubm-btn ubm-refill` (matching the existing
     `.ubm-btn` base class used by the abandon button), **not** the brief's literal
     `ui-btn ubm-refill` — there is no global `.ui-btn` in this repo. No new CSS/colors
     were added; the button reuses the existing `.ubm-btn` styling verbatim, so no
     specificity/variant-hover issue applies (it isn't a color variant like `.ubm-danger`).

2. **`Files.vue`**
   - Added `refillPending = ref<{ targetPath: string; missing: Set<string> } | null>(null)`.
   - Added `onRefill(p)`: stores the pending refill target/missing set, then calls
     `triggerFolderSelect()` (not the single-file picker — missing entries can carry a
     sub-path like `Trip/a.jpg`, and only a `webkitdirectory` input yields
     `webkitRelativePath`).
   - `commitSelectedFiles` now has a refill branch inserted **after** the snapshot-view
     guard and **before** the normal path: it filters `entries` down to only those whose
     `relativePath` is in `pending.missing`, uses `pending.targetPath` (the batch's own
     `target_path`, not `files.currentPath`) to build the `SelectedFile[]`, and calls
     `addFilesToQueue`. If nothing in the picked folder matches, it toasts
     `filesBatchRefillNoMatch` and returns without calling `addFilesToQueue`.
   - `onRefill` is now exposed via `defineExpose` alongside `handleSelectedFiles` (the
     lone pre-existing `defineExpose({ handleSelectedFiles })` further down was removed
     to avoid a duplicate call) so the regression test can drive it directly.
   - Wired `@refill="onRefill"` on the `<UploadBatchModal>` mount.
   - All three comments the brief wrote in Chinese were rendered in English, preserving
     the full reasoning (see diff above): why bytes can't be recovered and the user must
     re-pick; why the folder picker specifically; why `target_path` and not
     `files.currentPath`.

3. **i18n**: added `filesBatchRefill` / `filesBatchRefillNoMatch` to both
   `zh_cn.base.ts` and `en_us.base.ts` with the brief's exact copy.

## How the Step 6b test proves the filter and the target-path choice

In `src/views/Files.upload.test.ts`, the fixture deliberately routes the mounted view to
`/files/Elsewhere` (so `files.currentPath` is *not* `/DATA/x`) and then calls `onRefill`
with `targetPath: '/DATA/x'`. Two files are then "picked": one (`Trip/a.jpg`) named in the
missing list, one (`Trip/c.jpg`) not. The assertion:

```ts
expect(files.currentPath).not.toBe('/DATA/x')
...
expect(spy).toHaveBeenCalledTimes(1)
expect(spy).toHaveBeenCalledWith([
  { file: wanted, targetPath: '/DATA/x', relativePath: 'Trip/a.jpg' },
])
```

lands directly on the arguments handed to `addFilesToQueue` (the spy on
`uploads.addFilesToQueue`), not on any emit or internal flag. Because `files.currentPath`
and the batch's `targetPath` are forced to differ in the fixture, a regression that fell
back to `files.currentPath` (e.g. someone deletes the `pending` branch or mis-wires it)
would fail this assertion loudly — the `targetPath` in the call would read the wrong
value. And because `extra`/`Trip/c.jpg` is excluded from the single call's argument list
(`toHaveBeenCalledTimes(1)` with only `wanted` in the array), a regression that stops
filtering (passes all picked entries through) would also fail loudly.

The negative-path test asserts the mirror image:

```ts
expect(spy).not.toHaveBeenCalled()
expect(showSpy).toHaveBeenCalledWith(zh.filesBatchRefillNoMatch)
```

when the picked folder (`Other/z.jpg`) matches nothing in the missing list
(`['Trip/a.jpg']`).

## TDD evidence

**RED (Step 1/2 — UploadBatchModal.test.ts, before implementing the modal button):**
Ran `pnpm exec vitest run src/files/components/UploadBatchModal.test.ts` immediately
after adding the two new tests (before touching `UploadBatchModal.vue`):

```
FAIL  src/files/components/UploadBatchModal.test.ts > UploadBatchModal > emits refill with the target path and missing relative paths
Error: Cannot call trigger on an empty DOMWrapper.
FAIL  src/files/components/UploadBatchModal.test.ts > UploadBatchModal > disables refill when nothing is missing
Error: Cannot call attributes on an empty DOMWrapper.
 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)
```
Expected failure reason confirmed: `.ubm-refill` does not exist yet.

**GREEN (Step 5):** after adding the emit, `refill()`, and the footer button:
```
pnpm exec vitest run src/files/components/UploadBatchModal.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

**RED (Step 6b — Files.upload.test.ts):** implemented `onRefill`/`commitSelectedFiles`
refill branch first (per the brief's own step ordering: Step 6 implementation precedes
Step 6b's regression test), then to produce genuine RED evidence I `git stash`-ed only
the `Files.vue` change and re-ran the two new tests against the pre-Task-7 `Files.vue`:
```
pnpm exec vitest run src/views/Files.upload.test.ts
FAIL  ... refill: only re-enqueues entries named in the missing list ...
TypeError: w.vm.onRefill is not a function
FAIL  ... refill: toasts filesBatchRefillNoMatch and does not enqueue when nothing matches
TypeError: w.vm.onRefill is not a function
 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```
Expected failure reason confirmed: `onRefill` isn't exposed/doesn't exist without the
Files.vue implementation. Then `git stash pop` restored the implementation.

**GREEN:**
```
pnpm exec vitest run src/views/Files.upload.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## What was tested and results

- `pnpm exec vitest run src/files/components/UploadBatchModal.test.ts` — 7/7 passed.
- `pnpm exec vitest run src/views/Files.upload.test.ts` — 4/4 passed.
- `pnpm exec vue-tsc --noEmit` — clean, no output.
- `pnpm exec vitest run src/i18n/parity.test.ts` — 9/9 passed.
- Full `pnpm test`, run twice:
  - **Before commit** (working tree had my uncommitted `src/*` changes on top of the
    pre-existing unrelated dirty files): `4 failed test files | 641 passed (645)`,
    `3 failed | 10335 passed | 70 skipped (10408)`. All 4 failures
    (`oss/cli-args.test.mjs`, `oss/export-rsync.test.mjs`, `oss/media-wave.test.mjs`,
    `oss/tree.test.mjs`) failed on the *same* cause: `export.mjs`'s own dirty-tree guard
    refuses to run while files under `src/` are uncommitted — it explicitly allow-lists
    `oss/` and `design-export/` dirtiness but not `src/`. I verified this is not a Task 7
    regression by stashing away only my Task 7 `src/*` changes and re-running
    `oss/cli-args.test.mjs` + `oss/export-rsync.test.mjs` against the pre-existing dirty
    tree alone (design-export deletions + oss/* modifications) — both passed clean
    (6/6), confirming the guard only trips on dirty `src/` files, which is exactly the
    state my in-progress (uncommitted) edit produced.
  - **After commit** (only the pre-existing unrelated dirty files — design-export
    deletions, `oss/README.md`/`export.mjs`/`manifest.mjs`, untracked
    `oss/cli-args.test.mjs` — remain, `src/` is clean again): **`645 test files passed
    (645)`, `10408 tests passed (10408)`** — fully green, no failures, no skips beyond
    the pre-existing 70 (which weren't skipped in this final clean run — all 10408 ran
    and passed).
  - Test count went from the controller-verified baseline of 10404 to 10408 (+4: two new
    `UploadBatchModal.test.ts` cases, two new `Files.upload.test.ts` cases).

## Files changed (all under this repo: `/home/nimo/NimoTech/NimoOS-New-UI`)

- `src/files/components/UploadBatchModal.vue`
- `src/files/components/UploadBatchModal.test.ts`
- `src/views/Files.vue`
- `src/views/Files.upload.test.ts`
- `src/i18n/zh_cn.base.ts`
- `src/i18n/en_us.base.ts`

## Self-review findings

- Scope matches the brief exactly: no adjacent refactors, no unrelated file touches.
- Every visible-color rule: **no new CSS was added at all** — the refill button reuses
  the pre-existing `.ubm-btn` class verbatim, so there's nothing new to token-check.
- Confirmed the `ubm-refill` button is *not* a color variant like `.ubm-danger`, so the
  `:hover` specificity trap the controller warned about does not apply — it inherits
  `.ubm-btn`'s existing (already-tokenized) hover background.
- The Step 6b assertions land on `addFilesToQueue`'s actual call arguments (confirmed
  above), not on the modal's emit or on internal store state — satisfying the "the
  load-bearing part" requirement.
- Verified via RED-test evidence (not just inspection) that both the modal button and
  the Files.vue wiring are actually required by their respective tests.
- `git status` before committing showed only the intended 6 files staged; the 3 staged
  `design-export/*.html` deletions and modified/untracked `oss/*` files were confirmed
  untouched and unstaged throughout.
- Full-suite pass count and vue-tsc/parity all clean as required by Step 7.
- No `deploy.sh` run, no push to origin.

## Concerns

- **Minor, pre-existing-shape, not introduced by me**: in `commitSelectedFiles`, if a
  refill is triggered while `refillPending` is set and the user is (implausibly)
  simultaneously in snapshot-browse mode, the early `browse.isSnapshotView` return fires
  *before* `refillPending.value` is cleared, leaving a stale pending filter for a
  subsequent normal upload. This exactly matches the brief's specified code order
  (verbatim per the task's instructions), and the interrupted-batch badge is not
  realistically reachable from snapshot/time-machine browsing (it surfaces on live
  upload entries), so I did not alter the brief's specified branch order to speculatively
  guard against an edge case outside this task's scope. Flagging for awareness only —
  no fix applied, no test added for it.
- The 4 `oss/*` test files transiently failed while my `src/` edits were uncommitted
  (expected: `export.mjs`'s guard blocks on dirty `src/`); this is not visible in the
  final committed state and required no code change to resolve — it resolved itself
  once Step 8's commit landed. Documenting it here in case a future task in this plan
  hits the same transient signal mid-work and wonders whether it's real.

---

# Fix report: stale `refillPending` leak (code review round)

Commit: `6468a54` — `fix(files): stop a stale refill filter from leaking into unrelated uploads`

## The findings

Code review found two independent ways `refillPending` (set by `onRefill`) survived past
its intended single use, both in `src/views/Files.vue`:

1. **Ordering leak (the one I had disclosed, but framed wrong):** the `browse.isSnapshotView`
   early return in `commitSelectedFiles` sat *before* the `pending` read further down, so an
   early return there skipped consuming the flag entirely, leaving it set for whatever
   unrelated upload came next once the user left the read-only view.
2. **Cancel leak (the important one, which I had missed):** cancelling the native
   folder-picker dialog that `onRefill` opens never fires a `change` event on the
   `<input type=file webkitdirectory>` element — there is no completion signal of any kind
   in that case. Since the only place that cleared `refillPending` was inside
   `commitSelectedFiles`'s `pending` branch (which only runs when `handleSelectedFiles`
   actually runs, which only happens on `change`), an ordinary cancel — click "re-upload
   missing files," think better of it, hit Cancel — left the flag permanently set. The
   user's *next* upload of any kind (drag-drop, the normal file/folder picker, paste) would
   then be silently filtered against the stale missing list and almost certainly match
   nothing, producing a confusing `filesBatchRefillNoMatch` toast instead of uploading.

## Mechanism chosen for the cancel leak, and what I ruled out

**Investigated and ruled out: the native `cancel` event.** Modern Chromium fires a `cancel`
event on `<input type="file">` when the picker is dismissed without a selection. I checked
whether it's usable here:
- jsdom (v24.1.3, this repo's test environment) does expose an `oncancel` IDL property on
  the input element, but it does not simulate a real OS file-picker dialog at all — the only
  way to "fire" it in a test would be to manually `dispatchEvent(new Event('cancel'))`
  myself, which would only prove that my own listener runs when I tell it to, not that a
  real browser's dismissal reaches it. That is not a meaningful regression test.
- More importantly, `cancel` on file inputs is a fairly recent, Chromium-specific addition
  and is not dependably available across the browsers this self-hosted NAS UI has to run in
  (it's reached from a browser on a home network, not a controlled Chromium-only fleet).
  Relying on it as the *only* fix would leave the leak fully open on any browser that
  doesn't fire it, which defeats the point of a "real fix, not a documented caveat."

**Chosen instead: make the stale flag harmless (the reviewer's suggested fallback).**
Since we can't reliably detect cancellation, the fix makes `refillPending` self-clearing at
every entry point *except* the one continuation that's allowed to consume it:
- `triggerFileSelect()` and `triggerFolderSelect()` (the two "open a picker" functions used
  by the toolbar chips and the right-click menu) now clear `refillPending` as their first
  statement, before opening any dialog.
- `onDrop` and `onPaste` — which reach `commitSelectedFiles` directly, without going through
  either trigger function — also clear it as their first statement.
- `onRefill` still sets `refillPending` and then opens the folder input **directly**
  (`folderInput.value?.click()`), bypassing `triggerFolderSelect()` on purpose — that
  wrapper's own clear-first behavior would otherwise immediately erase the flag `onRefill`
  just set.

The result: `refillPending` can only ever be observed as non-null by the very
`commitSelectedFiles` call that follows the `change` event from the folder dialog `onRefill`
itself opened. Any other route into file selection — a fresh click on either picker, a
drop, a paste — guarantees the flag is already `null` by the time `commitSelectedFiles`
runs, regardless of what happened to any earlier, cancelled refill attempt. This holds in
every browser, with no dependency on any particular input event being supported.

For the ordering leak, the fix reads `refillPending.value` into a local and sets the ref to
`null` in the same two lines, at the very top of `commitSelectedFiles`, before the
`browse.isSnapshotView` check (or any other guard) can return early. The flag is now
strictly single-use no matter which branch exits next.

## Covering tests

Both added to `src/views/Files.upload.test.ts` (which also needed a `service.snapshot`
mock added, to drive `browse.isSnapshotView` true via routing for the ordering-leak test):

1. **`refill: clicking the ordinary upload-folder chip clears a stale pending refill filter`**
   — covers the cancel leak. Calls `onRefill(...)` to arm the flag (simulating "user clicked
   re-upload, then cancelled" — no `change` ever follows), then drives the **real** DOM
   `.tb-upload-folder` chip's `click` handler (the actual `triggerFolderSelect()` code path,
   not a test-only hook), then calls `handleSelectedFiles` with an unrelated file. Assertion:
   ```ts
   expect(spy).toHaveBeenCalledTimes(1)
   expect(spy).toHaveBeenCalledWith([
     { file: unrelated, targetPath: files.currentPath, relativePath: 'Somewhere/z.jpg' },
   ])
   ```
   This lands on `addFilesToQueue`'s actual arguments — proving the unrelated file went
   through unfiltered, at `files.currentPath` (not the stale batch `target_path`) — not on
   `refillPending`'s value.

2. **`refill: a stale flag does not survive an early return in the snapshot-guard branch`**
   — covers the ordering leak. Routes into an actual snapshot-browse path
   (`/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Trip`, mirroring the existing
   pattern in `Files.test.ts`) so `browse.isSnapshotView` is genuinely `true` via real store
   computation (not mocked/stubbed), calls `onRefill(...)`, then calls `handleSelectedFiles`
   with a file that *does* match the missing list — asserting `addFilesToQueue` is not
   called (guard correctly still blocks writes in a read-only view). It then navigates away
   from the snapshot view and calls `handleSelectedFiles` again with a completely unrelated
   file. Assertion:
   ```ts
   expect(spy).toHaveBeenCalledTimes(1)
   expect(spy).toHaveBeenCalledWith([
     { file: unrelated, targetPath: files.currentPath, relativePath: 'z.jpg' },
   ])
   ```
   Again landing on the real call arguments, proving the flag didn't survive the earlier
   early return.

## TDD evidence

**RED** — ran both new tests against the pre-fix code (`git commit` at `57a4d5e`, before this
fix):
```
pnpm exec vitest run src/views/Files.upload.test.ts
 FAIL  ... refill: clicking the ordinary upload-folder chip clears a stale pending refill filter
AssertionError: expected "wrappedAction" to be called 1 times, but got 0 times
 FAIL  ... refill: a stale flag does not survive an early return in the snapshot-guard branch
AssertionError: expected "wrappedAction" to be called 1 times, but got 0 times
 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)
```
Expected-failure reason confirmed: in both cases `addFilesToQueue` was called **0** times,
not called-with-wrong-arguments — meaning the stale flag caused the unrelated file to be
filtered out entirely (no match against the old missing list), firing
`filesBatchRefillNoMatch` instead of uploading. This is exactly the bug shape the reviewer
described.

**GREEN** — after implementing both fixes:
```
pnpm exec vitest run src/views/Files.upload.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

## Commands run and results (post-fix, post-commit `6468a54`)

- `pnpm exec vitest run src/views/Files.upload.test.ts` — **6/6 passed** (the covering file).
- `pnpm exec vitest run src/views/Files.test.ts src/views/Files.openEntry.test.ts src/files/components/UploadBatchModal.test.ts` — **29/29 passed** (adjacent Files.vue test files that exercise drag-drop/snapshot/upload-batch behavior — checked for regressions from touching shared code in `Files.vue`).
- `pnpm exec vue-tsc --noEmit` — clean, no output.
- `pnpm exec vitest run src/i18n/parity.test.ts` — **9/9 passed**.
- Full `pnpm test`, run in the foreground after committing (`git status` confirmed only the
  pre-existing unrelated dirty files remained — `design-export/*` deletions and `oss/*`
  modifications/untracked, nothing from this task's `src/` changes): **`645 test files
  passed (645)`, `10410 tests passed (10410)`** — fully green. (10404 baseline + 4 from the
  first round of Task 7 + 2 from this fix round = 10410.)

## Files changed in this fix round

- `src/views/Files.vue`
- `src/views/Files.upload.test.ts`

## Self-review

- `git status` before `git add`/`git commit` showed only `src/views/Files.vue` and
  `src/views/Files.upload.test.ts` as modified beyond the pre-existing unrelated dirty
  files; `git add`/`git commit` both used explicit pathspecs; confirmed nothing under
  `design-export/` or `oss/` was staged.
- Did not touch the deferred Minor (path-only matching, no hash check) per the coordinator's
  instruction.
- No new colors/CSS were added — this fix is pure script-block logic.
- Both new tests assert on `addFilesToQueue`'s actual call arguments, per the reviewer's
  explicit requirement that a `refillPending === null` assertion alone would test the flag,
  not the behavior that broke.

## Concerns

None outstanding. Both leaks are now closed by a single mechanism (every non-refill entry
point clears the flag before it can be observed), which is inherently robust to future entry
points being added carelessly only if they remember to clear it too — flagging this as a
soft spot for future maintainers: adding a *new* way to reach `commitSelectedFiles` (e.g. a
future "upload from URL" feature) would need to remember this convention. There is no
compiler or lint enforcement of it; it relies on this comment trail.
