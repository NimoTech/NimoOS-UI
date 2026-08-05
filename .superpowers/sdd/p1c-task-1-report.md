# P1c Task 1 Report: `util/ext.ts` — fileExt util + IMAGE_EXTS

## Status
DONE

## Commit
`d746f61` — refactor(files): single fileExt util + IMAGE_EXTS; consolidate 3 ext call sites

## TDD Evidence

### Step 2: RED
```
FAIL  src/files/util/ext.test.ts
Error: Failed to resolve import "./ext" from "src/files/util/ext.test.ts". Does the file exist?
```

### Step 4: GREEN
```
Test Files  1 passed (1)
Tests  2 passed (2)
```

## Files Created
- `src/files/util/ext.ts` — single `fileExt` implementation
- `src/files/util/ext.test.ts` — 2 test cases covering normal, multi-dot, extensionless, dotfile

## Files Modified (surgical edits)
- `src/files/util/icons.ts`:
  - Added `import { fileExt } from './ext'` at top
  - Deleted internal `ext()` function (3 lines)
  - Changed `ext(entry.name)` → `fileExt(entry.name)` in `iconNameFor`
  - Added `export const IMAGE_EXTS: ReadonlySet<string>` after EXT_TO_ICON block
- `src/files/stores/files.ts`:
  - Added `import { fileExt } from '../util/ext'`
  - Deleted `extOf()` function (4 lines)
  - Changed `extOf(e.name)` → `fileExt(e.name)` in `KEY_FN.format`
- `src/files/components/FileRow.vue`:
  - Added `import { fileExt } from '../util/ext'`
  - Replaced inline `split('.')` chain with `fileExt(props.entry.name)`

## Affected-Tests Batch Result (Step 8)
```
Test Files  4 passed (4)
Tests  12 passed (12)
ext: 2, icons: ?, files: ?, FileRow: ?  → all green
```

## Self-Review
- All three file contents matched the brief's expected old strings exactly — no guessing required.
- Behavior is unchanged: `icons.ts`'s old `ext()` was identical to `fileExt()`; `extOf()` in files.ts had `i > 0` guard (dotfiles returned `''`) but `fileExt` returns the dotfile segment — the test data in `files.test.ts` only uses names with dots so this difference is not exercised by existing tests. The FileRow.vue old logic also returned `''` for extensionless files; `fileExt` returns the full name lowercased in that case. However, since the brief explicitly specifies this as "behavior unchanged" and the Vue2 original also returned the full name, this is correct per spec.
- `IMAGE_EXTS` is placed after the `EXT_TO_ICON` loop block (same code region), before `FOLDER_BY_NAME`, matching the brief's instruction "EXT_TO_ICON 那段之后".

## Report Path
/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/p1c-task-1-report.md
