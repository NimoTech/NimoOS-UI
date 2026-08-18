# Task 3 Report — Bug 7: shared folders wrongly treated as protected

## What changed

`src/files/util/protect.ts`:
- Removed `import { isAlreadyShared } from './shareGate'`.
- Removed the `if (isAlreadyShared(entry)) return false // 已分享` line from `canOperate()`.
- Left a comment in its place explaining why (bug.txt #7): backend cleans up share
  records on delete (`DeleteShareByPath`) and rewrites share paths on rename
  (`RewriteSharePathPrefix`); Vue2 never gated the operation, only hid the context-menu
  entry. The system-default-folder-name check and the mounted-point check are untouched.

`src/files/util/protect.test.ts`:
- Flipped the `已分享的目录不可操作` case to `已共享目录可以删除/剪切/重命名(…)`,
  asserting `canOperate(shared)` is now `true`, using the exact fixture from the brief
  (`aaa` at `/media/RAID_x/aaa`).
- Updated the `operableEntries` case that previously asserted shared+mounted both count
  as skipped (`targets: [], skipped: 2`) to the new semantics: shared folders pass
  through, only the mount point is skipped (`targets: [shared], skipped: 1`). Renamed it
  to `counts mount points as skipped but lets shared folders through (bug.txt #7)`.
- All other cases (PROTECTED names, mounted-point gate, `splitProtectedUploads`) left
  untouched — they don't touch the shared path.

`src/views/__tests__/Files.deleteGate.test.ts` and
`src/files/composables/useFileOps.test.ts`: **no changes needed.** Grepped both files for
`shared`/`isAlreadyShared`/`protect`/`canOperate`/`operableEntries` — their "protected"
fixtures only use the `PROTECTED` system-folder-name list (e.g. `Documents`), never
`extensions.share`. No shared-block behavior was hardcoded in either file.

`shareGate.ts` was not touched — `isAlreadyShared` and `shareableFolders` remain exported
and are still consumed by `FileContextMenu.vue` (share menu state), confirmed via grep.

## RED → GREEN evidence

RED (`pnpm vitest run src/files/util/protect.test.ts`, before implementation change):
```
FAIL  src/files/util/protect.test.ts > protect > 已共享目录可以删除/剪切/重命名(后端会自行清理共享记录,Vue2 也从不拦截)
AssertionError: expected false to be true
FAIL  src/files/util/protect.test.ts > operableEntries > counts mount points as skipped but lets shared folders through (bug.txt #7)
AssertionError: expected [] to deeply equal [ { name: 'Shared', … } ]
Test Files  1 failed (1)
     Tests  2 failed | 15 passed (17)
```

GREEN (`pnpm vitest run src/files/util/protect.test.ts src/views/__tests__/Files.deleteGate.test.ts src/files/composables/useFileOps.test.ts`, after implementation change):
```
Test Files  3 passed (3)
     Tests  63 passed (63)
```

## Files touched

- `src/files/util/protect.ts`
- `src/files/util/protect.test.ts`

(`Files.deleteGate.test.ts` and `useFileOps.test.ts` inspected, no edits required.)

## Commit

`d6494d0` — `fix(files): stop treating shared folders as protected`

## Self-review / concerns

- Diff is minimal and matches the brief's exact prescribed code and comment text.
- `PROTECTED` names and `mounted` checks are byte-for-byte unchanged.
- Confirmed no other test file in the repo asserts the old shared-block behavior via
  `grep -rn "isAlreadyShared"` (only `shareGate.ts` definition + `shareableFolders` use +
  `FileContextMenu.vue` consumer remain).
- No CSS/theme, no `packages/service/` changes — out of scope for this task and untouched.
- A full-repo `pnpm test` sanity pass was also run as an extra check beyond the brief's
  required scope: **695 files / 11218 tests, 5 files / 4 tests failed** — all failures
  are in `src/home/components/DesktopContextMenu.test.ts` (`handles a right-click on
  blank canvas`, reproducible in isolation) plus 4 more in unrelated `home` desktop
  files, none of which reference `protect.ts`, `shareGate.ts`, `canOperate`, or
  `isAlreadyShared` (grepped to confirm). This is a pre-existing failure on this branch
  unrelated to this task's diff, not something this change introduced.
