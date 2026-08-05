# Task 1.5 Report — 抽共享扩展名分类常量 fileCategories.ts

## Status: DONE

## Commit
`ad3755e` — refactor(files): 抽 fileCategories 共享扩展名分类常量(icons.ts + panelMap.ts 复用,消除重复)

Staged/committed files (exactly 3, verified via `git status --porcelain` before commit):
- `src/files/util/fileCategories.ts` (new, 22 lines)
- `src/files/util/icons.ts` (modified, now 91 lines)
- `src/files/viewers/panelMap.ts` (modified, now 28 lines)

No test file needed an import tweak — neither `icons.test.ts` nor `panelMap.test.ts` referenced the internal `TYPE_MAP`/`typeMap` objects directly (verified via `grep -n "typeMap\|TYPE_MAP"` on both — no hits), so they were left untouched.

## TYPE_MAP key order — before vs after (proof of no drift)

**Before** (icons.ts, original inline object):
```
image-x-generic, video-x-generic, audio-x-generic, text-x-generic, text-markdown,
text-css, text-html, application-vnd.ms-word, application-vnd.ms-excel,
application-vnd.ms-powerpoint, application-pdf, application-photoshop,
application-illustrator, application-x-wine-extension-cpl, application-apk,
application-x-zip, application-x-cd-image, application-x-apple,
application-x-pem-key, text-x-cmake, text-dockerfile
```

**After** (icons.ts, referencing shared constants):
```
image-x-generic, video-x-generic, audio-x-generic, text-x-generic, text-markdown,
text-css, text-html, application-vnd.ms-word, application-vnd.ms-excel,
application-vnd.ms-powerpoint, application-pdf, application-photoshop,
application-illustrator, application-x-wine-extension-cpl, application-apk,
application-x-zip, application-x-cd-image, application-x-apple,
application-x-pem-key, text-x-cmake, text-dockerfile
```

**Identical, key-for-key, in the same order.** `text-x-cmake` (containing `dockerfile`) still
precedes `text-dockerfile` as the last key, so `EXT_TO_ICON['dockerfile']` still resolves
to `'text-dockerfile'` via last-match-wins in the unchanged `for (const [icon, exts] of
Object.entries(TYPE_MAP))` loop (that loop itself was not touched).

This is directly exercised by `icons.test.ts` lines 35-37:
```ts
// dockerfile: text-x-cmake entry comes first, text-dockerfile entry comes last → last wins
expect(iconNameFor({ name: 'Dockerfile', is_dir: false })).toBe('text-dockerfile')
expect(iconNameFor({ name: 'x.dockerfile', is_dir: false })).toBe('text-dockerfile')
```
— which passed unmodified after the refactor.

## Array value verification

All 21 category arrays in `fileCategories.ts` were copied verbatim (byte-for-byte, including
element order within each array) from the real `src/files/util/icons.ts` as it existed before
the edit (confirmed by reading the file directly, not just the brief's transcription — the
brief's Step 1 listing matched the real source exactly, no discrepancies found).

`panelMap.ts`'s 8 pre-refactor arrays (`image-x-generic`, `audio-x-generic`, `text-x-generic`,
`text-markdown`, `text-css`, `text-html`, `text-x-cmake`, `text-dockerfile`) were confirmed
byte-identical to their icons.ts counterparts before the refactor (this was already an
invariant documented in panelMap.ts's own comment: "全部与 icons.ts 中同名数组逐字节相同").

`browserPlayableVideo = ['mp4', 'm4v', 'webm', 'mov', '3gp']` was left untouched, still declared
locally in panelMap.ts, not moved to fileCategories.ts (it has no icons.ts counterpart —
panel-specific).

`IMAGE_EXTS = new Set(TYPE_MAP['image-x-generic'])` in icons.ts is unaffected — `TYPE_MAP` still
exists as an object, `TYPE_MAP['image-x-generic']` now resolves to the imported
`IMAGE_X_GENERIC` array reference, same contents.

## Test results

```
pnpm test -- icons
 Test Files  1 passed (1)
      Tests  4 passed (4)

pnpm test -- panelMap
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

Both suites all-green, no assertion changes made to either test file (confirmed via `git diff`
— no test files appear in the diff/commit).

## Type check

```
pnpm exec vue-tsc --noEmit
```
0 errors (empty output).

## Files changed (diffstat)

```
 src/files/util/icons.ts       | 67 +++++++++++++++++++++++++++++--------------
 src/files/viewers/panelMap.ts | 23 ++++-----------
 2 files changed, 51 insertions(+), 39 deletions(-)
 create mode 100644 src/files/util/fileCategories.ts (22 lines)
```
Final line counts: `fileCategories.ts` 22, `icons.ts` 91, `panelMap.ts` 28.

## Self-review

- **Completeness**: `fileCategories.ts` is now the single source of truth for all 21 category
  arrays. `icons.ts` imports 21 constants and references them by name in `TYPE_MAP` (no inline
  array literals remain for these categories). `panelMap.ts` imports the 8 constants it uses
  (no inline array literals remain except `browserPlayableVideo`, which is intentionally local).
  No duplicate literal arrays remain in either file for the shared categories.
- **Correctness**: TYPE_MAP key order is identical before/after (quoted above); dockerfile→
  text-dockerfile last-match-wins behavior preserved and test-verified. Array values were
  copied directly from source, not retyped from the brief.
- **Discipline**: `EXT_TO_ICON` loop, `IMAGE_EXTS`, `FOLDER_BY_NAME`, `iconNameFor`, `iconUrl`,
  the Vite icon glob in icons.ts — all untouched (only the import block and `TYPE_MAP` literal
  body changed). `getPanelType`, `PanelType`, `filePanelMap` composition, `union()` helper,
  `browserPlayableVideo` in panelMap.ts — all untouched (only the import block and the array
  references inside `filePanelMap` changed, replacing `typeMap['key']` with the named
  constant). No test assertions were touched or weakened.
- **Testing**: Both `icons` and `panelMap` vitest suites pass with clean, non-flaky output
  (11 tests total, 0 failures). `vue-tsc --noEmit` reports 0 errors project-wide.

## Concerns

None. This was a mechanical, low-risk refactor; the critical last-match-wins invariant is
both structurally preserved (identical key order) and behaviorally verified by an existing
test that was not modified.
