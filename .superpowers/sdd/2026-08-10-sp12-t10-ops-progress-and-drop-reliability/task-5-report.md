# Task 5 report — retire `OperationStatusBar`

## Step 1: gate check

```
$ grep -rn "OperationStatusBar" src/
src/files/components/OperationStatusBar.test.ts:6:import OperationStatusBar from './OperationStatusBar.vue'
src/files/components/OperationStatusBar.test.ts:20:describe('OperationStatusBar', () => {
src/files/components/OperationStatusBar.test.ts:24:    const wrapper = mount(OperationStatusBar, { global: { plugins: [i18n] } })
src/files/components/OperationStatusBar.test.ts:31:    const wrapper = mount(OperationStatusBar, { global: { plugins: [i18n] } })
src/files/components/OperationStatusBar.test.ts:42:    const wrapper = mount(OperationStatusBar, { global: { plugins: [i18n] } })
src/files/components/OperationStatusBar.vue:1:<!-- src/files/components/OperationStatusBar.vue -->
src/files/util/fileOps.ts:14:// socket props.file_operate 是 JSON 串 → { data: FileTask[] }(移植 Vue2 OperationStatusBar)
src/apps/views/AppSettingsPage.vue:190:     OperationStatusBar.vue 等)——brief 原稿写的 background: var(--remove-bg) 与本行 color 撞色(两者色相/明度
src/views/Files.vue:17:import OperationStatusBar from '../files/components/OperationStatusBar.vue'
src/views/Files.vue:739:    <OperationStatusBar />
```

Matches the brief's expected shape exactly: `Files.vue` (import + template tag), the
component itself, its own test, and the two documented comment-only mentions
(`fileOps.ts`, `AppSettingsPage.vue`). No third consumer found — not blocked.

## What was deleted / changed

- Deleted `src/files/components/OperationStatusBar.vue` and
  `src/files/components/OperationStatusBar.test.ts` via `git rm`.
- `src/views/Files.vue`: removed the import line
  `import OperationStatusBar from '../files/components/OperationStatusBar.vue'`
  and the template tag `<OperationStatusBar />`. Confirmed
  `bus.on('nimoos:file:operate', ...)` and `src/files/stores/fileOps.ts` were
  not touched (untouched by `git diff`, and `git status` shows no changes to
  `fileOps.ts` store — only the util file, per brief).
- `src/files/util/fileOps.ts`: rewrote the dangling Chinese comment above
  `parseFileOperate` to the English text specified in the brief verbatim:
  ```ts
  // socket props.file_operate is a JSON string -> { data: FileTask[] } (ported
  // from Vue2's FilePanel socket handler).
  ```
- `src/apps/views/AppSettingsPage.vue` (line ~190): rewrote the comment
  referencing the now-deleted `OperationStatusBar.vue` to point at
  `UploadPanel.vue` instead, per the brief's instruction that the same
  precedent still applies with the new host component.

Post-edit grep confirms zero remaining references anywhere in `src/`.

## Step 5: type check + full suite (foreground)

Commands run, in order:

1. First attempt (before committing):
   ```
   pnpm exec vue-tsc --noEmit && pnpm exec vitest run
   ```
   `vue-tsc` failed with pre-existing errors unrelated to this task:
   ```
   src/settings/panels/LanDevicesPanel.vue(14,24): error TS2305: Module
     '"@nimotech/nimoos-service"' has no exported member 'LanDevice'.
   src/settings/panels/LanDevicesPanel.vue(31,35): error TS2339: Property
     'getLanDiscovery' does not exist on type '{...}'.
   ```
   Verified via `git stash` that this error exists on the pre-task commit too
   (`86cd807`), i.e. it predates and is unrelated to this task's changes.
   Root-caused it as the documented hardlink-breakage issue from
   `CLAUDE.md` (packages/service is served via a pnpm hardlink into
   `node_modules/.pnpm/...`; `stat -c '%i %n'` on `sys.ts` showed two
   different inodes between `packages/service/src/sys.ts` and its
   `node_modules/.pnpm/...` counterpart). Ran `pnpm install` to relink;
   `stat` afterward showed identical inodes (3674723 on both sides).

2. Re-ran `pnpm exec vue-tsc --noEmit` (before committing): passed (`TSC_OK`).

3. Ran `pnpm exec vitest run` (before committing, tree still dirty at this
   point — Step 6 commit had not happened yet): **4 test files failed**
   (`oss/media-wave.test.mjs`, `oss/tree.test.mjs`, `oss/cli-args.test.mjs`
   with 2 failing cases, `oss/export-rsync.test.mjs`), all with the identical
   root cause:
   ```
   [oss] 失败:<worktree> 工作树不干净,导出中止:
    M src/apps/views/AppSettingsPage.vue
    D src/files/components/OperationStatusBar.test.ts
    D src/files/components/OperationStatusBar.vue
    M src/files/util/fileOps.ts
    M src/views/Files.vue
   ```
   These `oss/*` tests shell out to `oss/export.mjs`, which refuses to run
   when `git status` is not clean. This is a self-inflicted, mechanical
   side-effect of running the full suite *before* committing (as Step 5
   instructs) while the task's own edits are still uncommitted — not a
   regression. Verified the hypothesis directly: `git stash -u` (clean tree)
   + `pnpm exec vitest run oss/` → **7 files / 146 tests, all passed**.
   Result before commit: **683 passed / 4 failed test files,
   11008 passed / 3 failed / 70 skipped tests (11081 total)**.

4. **Step 6 commit** (see below), then re-ran the full command on the now
   clean, committed tree:
   ```
   git status --short   # empty
   pnpm exec vue-tsc --noEmit && echo "TSC_OK" && pnpm exec vitest run
   ```
   Result: `TSC_OK`, then:
   ```
   Test Files  687 passed (687)
        Tests  11081 passed (11081)
   ```
   Zero failures, zero skipped-as-failed. (70 previously-reported "skipped"
   tests are intentional `it.skip`/`describe.skip` cases elsewhere in the
   suite, included in the 11081 total, not a regression — same count
   appeared in the pre-commit dirty-tree run too, just folded differently in
   the failed-run tally.)

No test file count dropped from deleting `OperationStatusBar.test.ts` in a
way that shrank total suite size in the final green run — file count is
687 in both the pre-existing baseline and the post-commit run (the earlier
attempt showed 687 total as well, just split 683 passed / 4 failed due to
the dirty-tree gate, not because a file went missing).

## Commit

```
41f828c refactor(files): retire the standalone operation status bar

 src/apps/views/AppSettingsPage.vue              |  2 +-
 src/files/components/OperationStatusBar.test.ts | 46 --------------------
 src/files/components/OperationStatusBar.vue     | 56 -------------------------
 src/files/util/fileOps.ts                       |  3 +-
 src/views/Files.vue                             |  2 --
 5 files changed, 3 insertions(+), 106 deletions(-)
```

Message matches the brief's exact text (including the `Co-Authored-By` trailer).

## Concerns

- None outstanding. The one hard boundary (`Files.vue`'s
  `bus.on('nimoos:file:operate', ...)` and all of
  `src/files/stores/fileOps.ts`) was not touched — confirmed by `git diff`
  showing no changes to `fileOps.ts` (the store) and no changes to that
  socket-wiring line in `Files.vue`.
- Pre-existing, unrelated finding surfaced along the way: the
  `LanDevicesPanel.vue` type errors were caused by a broken pnpm hardlink
  for `packages/service` (documented trap in this repo's `CLAUDE.md`). Fixed
  locally by running `pnpm install` (no `--force`, no cache clear, per the
  documented remedy). This was necessary to get a clean `vue-tsc` baseline
  to test against and is not part of this task's deliverable, but worth
  flagging since it affected this worktree's `node_modules` state.
- The 4 `oss/*` test failures during the pre-commit run were expected and
  self-resolved after committing; noting this explicitly since the task
  brief's Step 5 (test before commit) and the oss export guard's
  clean-tree requirement are structurally in tension whenever Step 5 is run
  literally before Step 6. Future tasks following this same step order will
  hit the same transient failure and should not treat it as a real
  regression — verify via `git stash` isolation as done here, then commit
  and re-verify.
