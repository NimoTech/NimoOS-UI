# Final fix wave — empty-dir path-length preflight

## Finding 1 (Important) — fixed

`src/views/Files.vue`, `commitSelectedFiles`: the length preflight (`fitsLimits` =
per-segment `nameTooLong` + `pathTooLong(joinPath(targetPath, rel))`) ran only over
`normalized` (file entries). The `emptyDirs: string[]` parameter — wired in from
drag-drop via `readDroppedEntries` → `splitProtectedUploads` → `commitEmptyDirs` — never
passed through it, so a dropped empty folder at the deepest allowed path skipped the
clear `filesUploadPathTooLong` toast and went straight to the backend's uninformative
`Fail` (via `service.folder.create` → `MkdirAll`).

Fix: `emptyDirs` is now filtered through the same `fitsLimits` predicate
(`emptyDirs.filter(fitsLimits)` → `withinLimitsDirs`), and the removed-dir count is
folded into the SAME `tooLong` total as the removed-file count, so exactly one
`filesUploadPathTooLong {count}` toast fires for the whole batch (files + dirs combined),
never two separate toasts. `withinLimitsDirs` (not the raw `emptyDirs`) is what now
feeds the downstream protected-directory gate (`splitProtectedUploads`) and eventually
`commitEmptyDirs`.

Verified the "all dirs filtered out" edge case does not need extra guarding:
`commitEmptyDirs` already starts with `if (!dirs.length) return`, so a batch whose
`dirsAllowed` ends up empty (all filtered by length or protection) is a silent no-op —
no stray toast, no network call.

Relevant diff (`src/views/Files.vue`, inside `commitSelectedFiles`):

```ts
const fitsLimits = (rel: string) =>
  !rel.split('/').some(nameTooLong) && !pathTooLong(joinPath(targetPath, rel))
const withinLimits = normalized.filter((e) => fitsLimits(e.relativePath))
const withinLimitsDirs = emptyDirs.filter(fitsLimits)
const tooLong = (normalized.length - withinLimits.length) + (emptyDirs.length - withinLimitsDirs.length)
if (tooLong > 0) toast.show(t('filesUploadPathTooLong', { count: tooLong }))
...
const { accepted: dirsAllowed, rejected: dirsProtected } =
  splitProtectedUploads(withinLimitsDirs.map((p) => ({ relativePath: p })))
```

No new i18n keys — reused the existing `filesUploadPathTooLong` key for both files and
dirs, per the "one combined toast" requirement. No color literals, no changes outside
`src/views/Files.vue` and its test file.

## Finding 2 (supporting test) — added

`src/views/Files.upload.test.ts`: added `vi.mock('../files/upload/dropEntries', ...)`
to stub `readDroppedEntries` (same seam `dropEntries.test.ts` exercises directly), and
added `create: vi.fn().mockResolvedValue(undefined)` to the existing `service.folder`
mock (previously only `getList` was mocked; `commitEmptyDirs` needed `folder.create`).
Drop is driven through the real `.files-main` `@drop.prevent="onDrop"` handler (matching
this file's existing convention of driving `handleSelectedFiles`/`onRefill` through real
component entry points rather than reaching into private state).

Two new tests, both passing:

1. **"drop: an over-long empty dir is filtered like an over-long file, folded into ONE
   combined filesUploadPathTooLong toast"** — batch has one over-long file + one ok file,
   and one over-long empty dir (256-byte name) + one ok empty dir. Asserts:
   - `addFilesToQueue` called once, with only the ok file.
   - `service.folder.create` called once, only for the ok dir's joined path.
   - `toast.show` called with `filesUploadPathTooLong` count **2** (combined), and
     explicitly asserts it was NOT called with count **1** — this is what would fail if
     the fix regressed to two separate toasts (one per category) instead of one combined
     toast.

2. **"drop: a dirs-only batch, all within limits, still creates them and toasts
   filesEmptyDirsCreated (no early-return regression)"** — batch is two within-limits
   empty dirs, zero files. Asserts:
   - `addFilesToQueue` is never called (no files at all).
   - `service.folder.create` called for both dirs.
   - `filesEmptyDirsCreated {count:2}` toast fires — proving the "batch made of only
     empty dirs must still reach `commitEmptyDirs`" contract (the code comment right
     above `if (allowed.length)`) still holds after this change, i.e. no regression
     where filtering dirs through `fitsLimits` could accidentally short-circuit before
     `commitEmptyDirs`.

Both scenarios from the task brief are covered directly; nothing was skipped or judged
infeasible.

## Test evidence

```
$ pnpm vitest run src/views/Files.upload.test.ts src/files/upload/emptyDirs.test.ts src/files/util/pathLimits.test.ts
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes
 Test Files  3 passed (3)
      Tests  19 passed (19)
```

```
$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

Full-suite `pnpm vitest run` was also run as a broader sanity check (not part of the
required gate; ran in the background since it exceeds 120s): **694 test files / 11167
tests passed, 3 tests / 4 files failed** — all four failures are in `oss/cli-args.test.mjs`
and `oss/export-rsync.test.mjs`, both asserting the OSS export guard refuses to run
against a dirty git working tree. They fail because of `bug.txt` and
`docs/superpowers/plans/2026-08-11-bugtxt-batch-fixes.md`, two **untracked files that
predate this fix wave** (confirmed via `git status` before any edit in this session) —
unrelated to Finding 1/2 and out of this task's scope to touch. After committing this
fix's two files (`git commit b7406975`), the working tree still carries those pre-existing
untracked files, so the same two oss-export tests would still fail on a rerun; this is a
pre-existing condition of the branch, not a regression introduced here.

## Concerns / notes

- The i18n copy for `filesUploadPathTooLong` still literally says "个文件路径过长"
  ("N files' paths are too long") / "path too long" in English — reusing it for a count
  that may include empty dirs is a minor copy imprecision (a combined count of "1 file +
  1 dir" now also renders as "已跳过 2 个文件路径过长"). The task explicitly said no new
  i18n keys were expected and to fold into the SAME toast, so this was accepted as
  intentional scope; flagging in case product wants a more generic string later (e.g.
  "N items" instead of "N files") in a future pass.
- No changes were made to `packages/service/`, no new color literals, no new i18n keys.
