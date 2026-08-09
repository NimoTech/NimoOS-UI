# Task 3 report: drop the needs_file re-pick flow

Commit: `5579dc6` — "refactor(files): drop the needs_file re-pick flow" (master, main worktree).

## What changed

- **Deleted** `src/files/upload/serverSync.ts` + `serverSync.test.ts` (brief Step 3).
- **`src/files/upload/types.ts`**: `UploadStatus` no longer has `'needs_file'`.
- **`src/files/stores/uploads.ts`**: removed the `ServerUploadTask` type import and the
  `planServerSync` import; deleted `reattachFiles()` and `syncServerTasks()` entirely;
  `initUploads()` reduced to the brief's 4-line shape (latch + `resumePending()`, no
  network call, no try/catch); removed `reattachFiles`/`syncServerTasks` from the
  store's returned object.
- **`src/files/components/UploadPanel.vue`**: removed the "重选文件" (Reselect) button,
  the `needsFileCount`-driven "需重新选择文件…" message line, the hidden
  `<input type="file" webkitdirectory>` reselect element, its `reselectInput` ref,
  `triggerReselect()`/`onReselect()` handlers, and the now-unused `.up-hidden-input`
  CSS rule.
- **i18n**: removed `filesUploadReselect` / `filesUploadNeedsFile` from both
  `zh_cn.base.ts` and `en_us.base.ts` (kept in parity).

### Beyond the brief's file list — required to keep the build/tests green

The brief's file list (types.ts, uploads.ts, UploadPanel.vue) undersold the blast
radius: `'needs_file'` was a string-literal member of `UploadStatus`, so grep turned up
real consumers the brief didn't name. I fixed these because leaving them would either
fail `vue-tsc` (comparing a status field against a literal no longer in the union is a
TS2367 error) or leave a guard-test-visible dead flow:

- **`src/files/upload/uploadBatches.ts`** (real logic, not a comment): `BatchView` had a
  `needsFileCount` field computed via `items.filter(i => i.status === 'needs_file')`,
  and it fed into the "problem zone" routing condition
  (`errorCount > 0 || needsFileCount > 0`). Removed the field and folded the routing
  condition down to `errorCount > 0`. This field would always have been `0` post-Task-3,
  so it's not just a rename — it was legitimately dead code once the status disappeared.
- **`src/files/upload/scheduler.ts`, `unloadGuard.ts`, `selectedFiles.ts`**: comment-only
  edits (no logic changed) — these files mentioned `needs_file` and/or
  `syncServerTasks`/`reattachFiles` in prose that would now be stale/wrong, and the new
  `noPersistence.test.ts` assertion scans every non-test `.ts` file in the directory for
  the literal string `needs_file`, so a stale comment would keep the guard test red.

I did not touch any other logic in these three files.

## Collateral test decisions

Brief's own arithmetic baseline: **"Verified baseline at f698518: pnpm test = 644 files
/ 10399 tests, all passing."** I verified this claim directly (details in "Concerns"
below) — it does not actually hold; there is one pre-existing, unrelated failing test at
that exact commit. Below I give the arithmetic just for the upload-layer test files this
task touches.

Deleted test files (whole file, git rm):
1. `src/files/upload/serverSync.test.ts` — brief-mandated (Step 3), 7 tests. Tested
   `planServerSync`, which is being deleted.
2. `src/files/stores/uploads.syncServerTasks.test.ts` — 3 tests. Entirely tests
   `store.syncServerTasks()`, which no longer exists. Not a fixture-fix candidate —
   every assertion in the file is about server-task reconciliation/appending, the exact
   abolished mechanism.
3. `src/files/stores/uploads.reattach-autostart.test.ts` — 2 tests. Entirely tests
   `store.reattachFiles()` auto-starting the scheduler, which no longer exists.

That's **3 test files deleted, 12 tests removed** as whole files.

Partial test removals within surviving files:
- `src/files/upload/uploadBatches.test.ts`: deleted the `describe('needs_file routing')`
  block (1 test) — it asserted `needsFileCount` and needs_file-driven zone routing,
  both now-deleted concepts. The sibling `describe('paused items routing')` block, which
  covers a structurally similar but still-real status, was left untouched.
- `src/files/components/UploadPanel.mixed-batch.test.ts`: deleted the
  `'shows both 重选文件 and 重试 for a needs_file + error batch'` test — it asserted the
  now-removed Reselect button renders. Kept the sibling `'shows 继续 for a paused + error
  batch'` test in the same file/describe block, which is unrelated.
- `src/files/stores/uploads.test.ts`: deleted `'initUploads calls syncServerTasks then
  resumes pending items'` and `'initUploads is idempotent: a second call... does not
  re-sync'` — both asserted against `service.file.listActiveUploads` and server-task
  appending, i.e. the abolished `syncServerTasks` mechanism specifically (the second
  test's own comment says "could double-append the same needs_file rows"). I replaced
  the idempotency test with a rewritten one, `'initUploads is a one-shot latch: a second
  call on the same store instance is a no-op'`, that verifies the still-present
  `initialized` latch (kept per the brief's Step 5.3 snippet) using the same
  observable-side-effect technique as the neighboring `resumePending` test (no
  `service.file.listActiveUploads` involved — that call is gone from `initUploads`
  entirely now). I also deleted the whole `describe('uploads reattachFiles', ...)` block
  (3 tests) — entirely about the deleted `reattachFiles()`.
  Net for this file: 20 tests → 17 tests (−4 deleted, +1 added).

Fixture-only fixes (test kept, assertion target unchanged, only the `status:
'needs_file'` fixture value swapped for a still-valid status — these were "merely
happens to construct a needs_file fixture" cases per the brief's judgement rule):
- `src/files/stores/uploads.cancel.test.ts`: `serverRow()`'s `status: 'needs_file' as
  const` → `'paused'`. The test (`cancel resolves the tus id for server-origin rows`)
  only exercises `resolveTusId`/`cancelItem`'s id/url parsing — status is incidental
  scaffolding, never asserted on.
- `src/files/stores/uploads.test.ts`, `'resumePending starts upload only when a pending
  item has a file'`: fixture item's `status: 'needs_file'` → `'error'`. The test is
  about `resumePending()` ignoring any non-pending item; the exact non-pending status
  used was never the point.
- `src/files/upload/unloadGuard.test.ts`: `hasActiveUploads` test's `status: 'needs_file'`
  case → `'paused'`, and renamed the test description accordingly. `hasActiveUploads`'s
  own doc comment ("Excludes 'needs_file' items...") was also rewritten to describe the
  behavior in terms of the current status set (done/error/paused/conflict all have "no
  in-flight bytes to lose").

### Test-file-count arithmetic (upload layer + its consumers)

9 test files in this area existed before this task (`serverSync.test.ts`,
`uploads.syncServerTasks.test.ts`, `uploads.reattach-autostart.test.ts`,
`uploads.test.ts`, `uploads.cancel.test.ts`, `unloadGuard.test.ts`,
`uploadBatches.test.ts`, `UploadPanel.mixed-batch.test.ts`, `noPersistence.test.ts`) →
**6 remain** (3 deleted outright: `serverSync.test.ts`,
`uploads.syncServerTasks.test.ts`, `uploads.reattach-autostart.test.ts`).

This matches the full-suite file count exactly: `pnpm test` went from 644 test files
(brief's stated baseline) to 641 after this commit — a delta of −3, i.e. no other test
files appeared or disappeared anywhere else in the repo from this change.

## The `scheduler.ts` `resumed:` consequence

Per the task framing: after Task 2, the only two producers of non-`fq_`-prefixed queue
item ids were `serverSync.ts`'s `planServerSync` (server-only task → appended row with
`id = tus id`) and `reattachFiles` (which never changed an item's `id`, but only ever
operated on rows that `syncServerTasks` had appended with a server id in the first
place). I deleted both. `addFilesToQueue` — the only remaining producer of queue items —
always assigns `id: \`fq_${Date.now()}_${i}_...\``.

**Conclusion: I left `scheduler.ts`'s `resumed: !item.id.startsWith('fq_')` expression
and both of `scheduler.test.ts`'s regression tests (`'sends resumed:false for a fresh
local (fq_-id) item'` and `'sends resumed:true for a server-reported (non fq_-id)
item'`) exactly as they are** — `scheduler.ts` is explicitly out of my brief's file list
and I was told not to touch those tests on my own initiative. But per the third option
offered, I'm flagging explicitly: **the `resumed: true` branch is now dead in
production.** Every item that reaches the scheduler via the store necessarily has an
`fq_` id, so `resumed` is unconditionally `false` in the running app after this commit.
The `'sends resumed:true...'` test still passes and is still a *correct* unit test of
`scheduler.ts`'s current logic in isolation (it feeds a hand-built `mkItem({ id:
'serverTusHexId' })` straight into the scheduler harness, bypassing the store
entirely) — but it now pins a code path that Task 4 (wiring `createBatch`) may or may
not resurrect. If Task 4 doesn't reintroduce a non-`fq_` id producer, this branch and
its test become permanently unreachable-in-practice and worth revisiting when that
task's shape is known.

## What I tested

TDD evidence:

**RED** — `pnpm exec vitest run src/files/upload/noPersistence.test.ts` after adding the
Step-1 assertion, before touching any source:
```
FAIL  src/files/upload/noPersistence.test.ts > upload layer carries no client-side byte persistence > has no needs_file status left in the upload layer
AssertionError: expected [ 'scheduler.ts', …(5) ] to deeply equal []
+ [ "scheduler.ts", "selectedFiles.ts", "serverSync.ts", "types.ts", "unloadGuard.ts", "uploadBatches.ts" ]
```
(Note: this differs from the brief's predicted `expected [ 'types.ts' ] to deeply equal
[]` — the brief undercounted; see "Beyond the brief's file list" above for why 6 files
hit, not 1. I did not stop and ask because the fix was mechanical and stayed inside the
same file set the guard test already scans — no design ambiguity, just more files
than predicted.)

**GREEN** — same command after all deletions/edits:
```
Test Files  1 passed (1)
     Tests  3 passed (3)
```

Full verification, run after all edits:
- `pnpm exec vitest run src/files/ src/i18n/parity.test.ts` → `98 passed / 693 tests passed`.
- `pnpm exec vue-tsc --noEmit` → clean, no output.
- `pnpm exec vitest run src/i18n/parity.test.ts` → passed (included above).
- Full `pnpm test` **before commit**: 4 test files failed — all 4 failures were
  `oss/export-*.test.mjs` guard tests that invoke the real `export.mjs`, which refuses
  to run against a dirty working tree outside `oss/`. I confirmed this is expected and
  not caused by my edits: stashing just `src/files` + `src/i18n` (leaving the
  pre-existing `design-export/*` deletions and `oss/*` modifications in place) made
  `oss/export-rsync.test.mjs` pass again — i.e. the export guard already tolerates the
  Controller-acknowledged pre-existing dirt, and only trips on *my own* uncommitted
  edits sitting outside `oss/`. I popped the stash back (confirmed content restored: no
  `needs_file` in `types.ts`/`uploads.ts`, 0 `reattachFiles`/`syncServerTasks` refs) and
  proceeded to commit.
- Full `pnpm test` **after commit** (tree back to the known "baseline-dirty" state):
  `640 passed | 1 failed` test files, `10381 passed | 1 failed` (10382 total). The one
  failure is `src/home/components/DesktopContextMenu.test.ts > ... > clicking the
  rendered item opens the wallpaper picker` (`Cannot call trigger on an empty
  DOMWrapper`) — completely unrelated to the upload/files-store code this task touches
  (home desktop wallpaper picker, last modified at `2e2ca74`/`628de2e`, both predating
  Task 2). I verified this is pre-existing, not something I introduced: I checked out
  `f698518` (Task 2's own claimed-clean baseline) into an isolated `git worktree` and
  ran that one test file there — **it fails identically at that commit**, so the
  brief's "644 files / 10399 tests, all passing" baseline claim does not hold as
  stated; there was already one broken, unrelated test. I did not fix it — it is out of
  this task's file list and subsystem (home/wallpaper, not files/upload).

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/upload/types.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/stores/uploads.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/components/UploadPanel.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/upload/uploadBatches.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/upload/scheduler.ts` (comment only)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/upload/unloadGuard.ts` (comment only)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/upload/selectedFiles.ts` (comment only)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/i18n/zh_cn.base.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/i18n/en_us.base.ts`
- Deleted: `/home/nimo/NimoTech/NimoOS-New-UI/src/files/upload/serverSync.ts`,
  `serverSync.test.ts`, `src/files/stores/uploads.syncServerTasks.test.ts`,
  `src/files/stores/uploads.reattach-autostart.test.ts`
- Test files edited: `src/files/upload/noPersistence.test.ts`,
  `src/files/upload/uploadBatches.test.ts`, `src/files/upload/unloadGuard.test.ts`,
  `src/files/components/UploadPanel.mixed-batch.test.ts`,
  `src/files/stores/uploads.test.ts`, `src/files/stores/uploads.cancel.test.ts`

## Self-review findings

- Verified no orphaned imports: `SelectedFile` type still used by `addFilesToQueue`;
  `useFilesStore`'s `files` binding in `UploadPanel.vue` still used via
  `files.displayNames` after removing `files.currentPath` (only used by the deleted
  `onReselect`).
- Verified no remaining references anywhere in `src/files` to `reattachFiles`,
  `syncServerTasks`, `planServerSync`, `ServerUploadTask`, `needsFileCount`, or
  `needs_file`, except the guard-test's own literal string and a stale comment in
  `scheduler.test.ts` (out of scope, see below).
- Verified both i18n locale files still have identical key sets (`parity.test.ts`
  green) and that `filesUploadReselect`/`filesUploadNeedsFile` are unreferenced
  anywhere before removal.
- Confirmed `git status` right before `git add -A src/files src/i18n` and right after —
  only `src/files/*` and `src/i18n/*` entered the index; `design-export/*` and `oss/*`
  stayed untouched, matching Controller ruling #2.

## Concerns

1. **`scheduler.test.ts`'s `resumed:true` regression test now pins an unreachable
   production path** (detailed above) — flagged per the task's third option, left as-is
   since `scheduler.ts` is outside this brief.
2. **`scheduler.test.ts` line 29's comment** ("a server-reported tus id
   (syncServerTasks/reattachFiles) does not") is now stale — both named functions are
   gone. I did not touch it since `scheduler.ts`/`scheduler.test.ts` are explicitly out
   of my brief's file list and the instruction was specifically "do NOT delete those
   tests on your own initiative"; I erred toward not touching that file's comments
   either, to keep the diff minimal and strictly brief-scoped. Worth a one-line fix in
   Task 4 or whichever task next touches `scheduler.ts`.
3. **The brief's stated baseline ("f698518: pnpm test = 644 files / 10399 tests, all
   passing") is not accurate** — `DesktopContextMenu.test.ts`'s wallpaper-picker test
   fails deterministically at that exact commit (verified via an isolated worktree
   checkout), unrelated to any upload-layer work. Pre-existing, out of scope for this
   task, but future task reports comparing counts against that baseline should account
   for this pre-existing 1-test gap.
