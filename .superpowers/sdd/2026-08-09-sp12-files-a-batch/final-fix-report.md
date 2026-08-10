# SP12 Files A-batch — final fix wave

Single repair pass after the whole-branch review. All findings below were
addressed in one sitting (worktree `sp12-files-fixes`, branch
`sp12-files-fixes`). Commits, in order:

1. `8e62ecd` — I2 (test) + B8 (fix): serial-chain interleave tests, paste
   listing-failure degradation.
2. `a86c2ac` — I3 (test) + I4 (feat+test): restore-progress wiring test for
   the toolbar, banner restore-progress binding + test.
3. `a811c23` — B1–B5: vacuous assertion, stale comments, leaking spy, dead
   'skip' style.
4. `56c617d` — B7 (fix+test): paste's `clipboard.clear()` reentrancy guard.
5. `125f560` — B9–B12: comment translation/correction, doc token-table fix,
   report correction, misleading test name.

(B6 landed inside commit 3, folded together with B5 since both touch
`buildPastePayload`'s signature/tests in the same hunk.)

## Important findings

### I2 — upload/paste serial-chain interleave was untested

**File:** `src/files/composables/useFileConflicts.ts` (no production change;
`resolvePaste` already correctly shares `chain` with `run()`).
**Test:** `src/files/composables/useFileConflicts.test.ts`, two new cases
under `describe('resolvePaste')`:
- `an upload batch already asking blocks a paste from opening its own dialog`
- `a paste already asking blocks an upload batch from opening its own dialog`

**Mutation verification** (swapped `resolvePaste` onto a private `pasteChain`,
per the review's own repro):
- Before revert: `2 failed | 24 passed (26)` — both new tests failed with
  `expected 'b.txt' to be 'a.txt'` (the paste's dialog opened immediately
  instead of waiting for the upload's still-open prompt).
- After revert: `26 passed (26)`.

The existing `runs on the same serial chain as upload batches` test was left
as-is (it still correctly pins two-pastes-never-overlap); the new tests cover
the actually-missing upload↔paste axis.

### I3 — Files.vue's `:restore-progress` binding to the toolbar was unwired in tests

**File:** `src/views/Files.vue` — no change (the binding at line 664/665
already existed); **test:** `src/views/Files.test.ts`, new case
`wires the snapshot store's restore progress into the selection toolbar`.

**Mutation verification** (deleted `:restore-progress="browse.restoreProgress"`
from the `SnapshotSelectionToolbar` instance):
- Before revert: `1 failed | 1 passed | 26 skipped (28)` — 
  `expected '恢复' to contain '3'`.
- After revert: full `Files.test.ts` + `SnapshotBanner.test.ts` +
  `SnapshotSelectionToolbar.test.ts` → `44 passed (44)`.

### I4 — SnapshotBanner's restore button had no progress display (the actual batch entry point)

**Files:**
- `src/files/snapshot/SnapshotBanner.vue` — added `restoreProgress?: { done, total } | null`
  prop; button text now reads `t('snapBrowseRestoringProgress', {...})` when set,
  otherwise `t('snapBrowseRestore')` (reused the existing key, no new i18n
  entries — matches SnapshotSelectionToolbar's own logic byte-for-byte).
- `src/views/Files.vue` — added `:restore-progress="browse.restoreProgress"` to
  the `<SnapshotBanner>` instance (it already had this on `SnapshotSelectionToolbar`,
  just missing on the banner).
- Tests: `SnapshotBanner.test.ts` new case (`shows the running count while a
  batch restore is in flight, reusing the toolbar's own text`) +
  `Files.test.ts` new case (`wires the snapshot store's restore progress into
  the banner's own restore button too`).

**Mutation verification** (deleted the new `:restore-progress` binding on
`<SnapshotBanner>`):
- Before revert: `1 failed | 1 passed | 26 skipped (28)` —
  `expected '恢复' to contain '3'`.
- After revert: `44 passed (44)` across the same three files.

No new styling/tokens — button reuses `.snap-banner-restore`'s existing
classes/tokens.

## Minor findings

| # | File(s) | What changed |
|---|---|---|
| B1 | `useFileOps.test.ts` | Vacuous `not.toHaveBeenCalledWith(zh.filesPastePartialFailure)` (raw un-interpolated template is never what's passed to `toast.show`) → `not.toHaveBeenCalledWith(expect.stringContaining('部分文件已粘贴'))`. |
| B2 | `Files.test.ts:44-46` | Comment rewritten to stop repeating the superseded ".vm.$emit() doesn't work" diagnosis; now consistent with the corrected explanation at (what was) line 214+. |
| B3 | `Files.test.ts:220-222` | Fixed line reference: `FileContextMenu` itself lives at `FilesSidebar.vue:220`, not `Files.vue:621` (that line only mounts `<FilesSidebar>`). |
| B4 | `TimeMachineRail.test.ts` | Two tests reassigned `Element.prototype.scrollIntoView` to a local spy and never restored it. Added `afterEach(() => { Element.prototype.scrollIntoView = () => {} })` to reset to the global no-op stub. |
| B5 | `fileOps.ts`, `fileOps.test.ts` | Removed dead `'skip'` branch from `buildPastePayload`'s `style` union (the conflict flow never submits skipped/cancelled items) and its test. |
| B6 | `fileOps.ts`, `fileOps.test.ts`, `useFileOps.test.ts`, `clipboard.ts` | `buildPastePayload` now strips `is_dir` before building the request body (`item.map(entry => ({ from: entry.from }))`), matching Vue2's `FilePanel.vue submitPasteTask`. Updated the two payload-shape tests plus the misleading `OperateItem` doc comment (which implied `is_dir` reaches the backend — it doesn't, it's local-only for the conflict dialog). |
| B7 | `useFileOps.ts`, `useFileOps.test.ts` | `paste()`'s `clipboard.clear()` on success now checks `clipboard.operateObject === o` (the object captured at the top of the call) before clearing — a reentrant copy/cut made while `resolvePaste` is still resolving conflicts no longer gets wiped. New test: `does not clear a different clipboard that was set while this paste was still resolving conflicts`. Ad hoc mutation check (removed the `=== o` guard): test failed with `Received: null` (clipboard wiped) vs expected the new copy's object; restored → green. |
| B8 | `useFileConflicts.ts`, `useFileConflicts.test.ts` | `resolvePaste` now degrades the same way `run()` does when the target-directory listing fails: warns to console and treats it as "no conflicts" (`renameItems: [...items]`) instead of rejecting the whole batch. New test: `a failing listing degrades to submitting everything as rename, without opening the dialog`. |
| B9 | `clipboard.ts`, `clipboard.test.ts` | Translated the two Chinese comment/description lines edited earlier in this same batch (commit `d4b8aa1`) to English, per this period's "translate legacy Chinese comments when already editing that code" rule. |
| B10 | `docs/superpowers/specs/2026-07-30-files-time-machine-design.md` | Removed the `--tm-star` row from the token table (the token itself was deleted in `be5b7e9`). |
| B11 | `.superpowers/sdd/2026-08-09-sp12-files-a-batch/task-10-report.md` | Corrected the defensive/unguarded `scrollIntoView` split: `PhotosSettings.vue:87` was miscounted into the defensive camp; its call (`el?.scrollIntoView({...})`) only guards the element, not the method — it belongs with the 3 unguarded call sites (Files.vue:457, MediaViewer.vue:205), making the split 3/3, not 4/2. |
| B12 | `snapshotBrowse.test.ts` | Renamed `clears the progress even when a restore throws` → `...fails` (the mocked rejection is caught inside `performSnapshotRestore` and converted to an `{ok:false}` result; `restore()` has no reachable throw path today). |

## Five-gate results (final, after all commits)

- **`pnpm exec vitest run` (full suite):** `Test Files 686 passed (686)` /
  `Tests 11042 passed (11042)`. (Two blocks of pre-existing, unrelated stderr
  noise appear in the log — jsdom's "Not implemented: navigation" from
  `src/photos/stores/favorites.ts`'s `exportZip` and one `/tmp/nimoos-www-*`
  permission warning from an unrelated fixture; neither is a failure, both
  predate this fix wave, and grep confirms `src/photos` was untouched here.)
- **`pnpm exec vue-tsc --noEmit`:** clean, no output.
- **`node oss/export.mjs --out /tmp/claude-1000/oss-fixwave --no-commit
  --allow-dirty-oss`:** `DELETE 73 · REPLACE 4 · PATCH 258`, **零真实泄漏命中**
  (3 binary/symlink files skipped as expected: two wallpapers + one PNG icon).
- **`pnpm build`:** succeeded (`✓ built in 17.00s`), only the pre-existing
  "chunks larger than 500kB" advisory (unrelated to this change).

All `src/**` changes were committed before running the OSS gate, per the
instructions, to avoid `checkClean` false-reds.

## Not done / disagreements

None. All 3 Important + 12 Minor items were implemented as specified. No
scope was skipped, no `useFileOps.ts` Esc/cancel semantics were touched, no
`oss/forbidden.mjs` changes, no master merge, no deploy, no push.
