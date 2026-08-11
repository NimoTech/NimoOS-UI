# Task 6 report — Bug 4: empty-folder drag-drop uploads were silently dropped

## Commit

`0b637d54` — `fix(files): create empty folders from drag-drop uploads` (branch `acceptance-bugfixes`)

7 files changed: `src/files/upload/dropEntries.ts`, `src/files/upload/dropEntries.test.ts`,
`src/files/upload/emptyDirs.ts` (new), `src/files/upload/emptyDirs.test.ts` (new),
`src/views/Files.vue`, `src/i18n/zh_cn.base.ts`, `src/i18n/en_us.base.ts`.

Two unrelated untracked files present in the worktree (`bug.txt`,
`docs/superpowers/plans/2026-08-11-bugtxt-batch-fixes.md`) were left untouched/unstaged —
out of scope for this task.

## What changed

1. **`dropEntries.ts`** — `walk()` now takes a third `emptyDirs: string[]` accumulator.
   When a directory's `readEntries()` comes back with zero children, its (leading-slash-
   stripped) path is pushed to `emptyDirs` and recursion stops there — only **leaf** empty
   dirs are recorded; the backend's `MkdirAll` fills in any empty parent chain.
   `readDroppedEntries` now returns `{ files: DroppedFile[]; emptyDirs: string[] }` instead
   of a bare array (`DroppedTree` interface exported). Both the entries-API branch and the
   flat-`dt.files` fallback branch return the new shape (`emptyDirs` is always `[]` in the
   fallback, since a flat file list carries no directory information).

2. **`emptyDirs.ts`** (new) — `createEmptyDirs(relPaths, targetPath)` calls
   `service.folder.create(joinPath(targetPath, rel))` per path, tolerating business code
   `20001` (`DIR_ALREADY_EXISTS`) as success. Returns `{ created, failed }`.

3. **`Files.vue`**:
   - `onDrop` now checks `!dropped.files.length && !dropped.emptyDirs.length` before
     bailing, and forwards `dropped.emptyDirs` as `commitSelectedFiles`'s new second arg.
   - `commitSelectedFiles(entries, emptyDirs: string[] = [])` — restructured (not just
     patched) so a pure-empty-dir batch reaches directory creation instead of being
     swallowed by an early return:
     - the snapshot-view read-only guard and the refill-no-match guard both now also
       consider `emptyDirs` (guard added defensively to the refill path even though onDrop
       always clears `refillPending` first, so emptyDirs and refill never actually co-occur
       today);
     - `emptyDirs` goes through `splitProtectedUploads` exactly like files, rejecting
       `AppData`/`Documents`/etc.-rooted paths with the same `filesUploadProtected` toast
       per name;
     - the file-upload path (conflict resolution + `addFilesToQueue`) is now wrapped in
       `if (allowed.length) { ... }` instead of `return`ing when there are no files, so
       control always reaches the new `commitEmptyDirs(dirsAllowed, targetPath)` call at
       the end;
     - `commitEmptyDirs` is a small local helper: calls `createEmptyDirs`, toasts
       `filesEmptyDirsCreated {count}` on any created, toasts `filesOpFailed` once if
       anything failed (not per-name — aggregated, since "which name failed" isn't
       actionable the way a protected-dir rejection is), and reloads the listing via
       `files.load(files.currentPath)` only when `targetPath === files.currentPath`.

4. **i18n** — added `filesEmptyDirsCreated` to both `zh_cn.base.ts` (`已创建 {count} 个空文件夹`)
   and `en_us.base.ts` (`Created {count} empty folder(s)`), next to `filesUploadSkipped`.

## RED → GREEN evidence

RED (before implementation):
```
FAIL src/files/upload/dropEntries.test.ts (6 failing incl. new emptyDirs assertions)
FAIL src/files/upload/emptyDirs.test.ts (module not found)
```

GREEN (after implementation), target suite:
```
pnpm vitest run src/files/upload/dropEntries.test.ts src/files/upload/emptyDirs.test.ts \
  src/views/Files.upload.test.ts src/views/__tests__/Files.uploadConflict.test.ts src/i18n/parity.test.ts

 Test Files  5 passed (5)
      Tests  37 passed (37)
```

`pnpm exec vue-tsc --noEmit` — clean, no errors (confirms the `readDroppedEntries` signature
change didn't break any caller; `grep -rn "readDroppedEntries\|commitSelectedFiles"` confirms
the only call sites are `Files.vue`'s own `onDrop`/`handleSelectedFiles`/`onPaste`, all updated
or compatible via the default `emptyDirs = []`).

Full repo suite (`pnpm test`) after committing: 693/697 files passed, 11156/11229 tests
passed. The 4 failing files are all under `oss/` (the open-source export guard, e.g.
`export-rsync.test.mjs`, `cli-args.test.mjs`) and fail only because they assert a **clean
working tree** before exporting — verified this is pre-existing, unrelated behavior by
`git stash`-ing my changes mid-session and re-running `oss/`: the same tests fail on ANY
dirty tree (two other untracked files from this batch's setup, `bug.txt` and the plan doc,
were already present before I touched anything). Not a regression from this task.

## Fixture/test notes

- `dropEntries.test.ts`'s existing fakes are `fileEntry(name, fullPath, content)`,
  `dirEntry(name, fullPath, children)`, `dtWithEntries(entries)` — different shapes from
  the brief's illustrative `dirEntry('empty', [])`/`fileEntry('d/x.txt')` snippets. Adapted
  the three new test cases to the file's real fixture signatures rather than introducing a
  second fixture style. All five pre-existing assertions were updated from `out.foo` to
  `out.files.foo` (and the `null` / fallback cases now assert the `{ files, emptyDirs }`
  shape).
- `emptyDirs.test.ts`: the brief's literal `create.mockRejectedValue(...)` (persistent
  mock) triggers a reproducible false-positive "unhandled rejection" test failure in this
  vitest version (4.1.9) whenever the rejected function comes from a `vi.mock(<module>)`-
  backed import (confirmed via isolated repro with a throwaway module — plain `vi.fn()`
  without `vi.mock` does not trigger it, and `mockRejectedValueOnce` does not trigger it
  even through a `vi.mock`-backed import). Debug logging confirmed `createEmptyDirs`'s
  `try/catch` correctly catches the rejection every time (code 20001 handled, `created`
  incremented) — the failure is purely a tooling artifact, not a code defect. Used
  `mockRejectedValueOnce` instead of `mockRejectedValue` in both error-path tests; since
  each test only triggers exactly one call to `create()`, this is behaviorally identical
  for the assertions made and is called out with an inline comment.
- `Files.upload.test.ts` and `Files.uploadConflict.test.ts` don't mock or call
  `readDroppedEntries`/`onDrop` at all, so no shape-migration edits were needed there (per
  the brief's own conditional wording); both still pass unmodified.

## Files touched (absolute paths)

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/files/upload/dropEntries.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/files/upload/dropEntries.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/files/upload/emptyDirs.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/files/upload/emptyDirs.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/views/Files.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/i18n/zh_cn.base.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/i18n/en_us.base.ts`

## Concerns / follow-ups

- Not deployed or verified on real hardware (per the batch's global constraints, this task
  was implementation + test-only). Real-device drag-drop-of-empty-folder verification is
  outstanding, same as the rest of this batch.
- `filesOpFailed` (generic "operation failed") is intentionally reused rather than a new
  dedicated key for empty-dir creation failures, per the brief's explicit correction in
  Step 5 (rejected the idea of reusing `filesUploadProtected` for this case — wrong
  semantics — and named `filesOpFailed` instead). No new key was introduced for this path.
